import type { INestApplication } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';

import { Bot, BotVersion } from '@/modules/bot/index.js';
import { Allocation, FundModule, FundService } from '@/modules/fund/index.js';

import { FakeTossModule } from './setup/fake-toss.js';
import { createTestApp, resetDatabase } from './setup/test-app.js';

// 투자금 확정·반환·다시 정하기를 실제 Postgres 제약(봇당 살아 있는 배분 1개, 트랜잭션)으로 확인해요 (POL-FUND)
describe('자금 배분 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let fund: FundService;
  const botIds: number[] = [];

  const active = () =>
    dataSource.getRepository(Allocation).find({
      where: { releasedAt: IsNull() },
      order: { botId: 'ASC' },
      take: 10,
    });

  beforeAll(async () => {
    app = await createTestApp([FakeTossModule, FundModule]);
    dataSource = app.get(DataSource);
    fund = app.get(FundService);
    await resetDatabase(app);
    const bots = await dataSource.getRepository(Bot).save(
      [0.1, 0.2, 0.3].map((ratio, index) => ({
        name: `bot-${index}`,
        type: 'day' as const,
        riskProfile: 'neutral' as const,
        stage: 'released' as const,
        status: 'running' as const,
        budgetType: 'ratio' as const,
        budgetRatio: ratio,
        startPriority: index,
        // 테스트가 어느 시각에 돌아도 운영 시간 밖이에요
        tradingStart: '00:00:00',
        tradingEnd: '00:00:01',
        periodStart: '2026-10-29',
        onPeriodEnd: 'liquidate' as const,
      })),
    );
    botIds.push(...bots.map(({ id }) => id));
    await dataSource.getRepository(BotVersion).save(
      bots.map(({ id }) => ({
        botId: id,
        version: 1,
        changeKind: 'initial' as const,
        params: {},
        orderSizeType: 'ratio' as const,
        orderSizeValue: 0.1,
        splitCount: 1,
        maxPositions: 3,
        dailyLossPct: 2,
        totalLossPct: 10,
        onDailyLimit: 'liquidate' as const,
        appliedAt: new Date(),
      })),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('같이 시작하는 봇 3개(10/20/30%)는 한 스냅샷으로 10만/20만/30만 원이 돼요', async () => {
    await fund.allocate(botIds);

    const rows = await active();
    expect(rows.map(({ amount }) => amount)).toEqual([
      100_000, 200_000, 300_000,
    ]);
    expect(new Set(rows.map(({ snapshotId }) => snapshotId)).size).toBe(1);
  });

  it('봇을 반환하면 반환 기록이 남고 살아 있는 배분에서 빠져요', async () => {
    const [first] = botIds;
    if (first === undefined) throw new Error('봇이 없어요');

    await expect(fund.release(first)).resolves.toBe(100_000);

    const released = await dataSource
      .getRepository(Allocation)
      .findOneByOrFail({ botId: first });
    expect(released.releasedAmount).toBe(100_000);
    expect(released.releasedAt).not.toBeNull();
    await expect(active()).resolves.toHaveLength(2);
  });

  it('다시 정할 운용 자산이 모자라면 기존 배분과 설정이 그대로예요', async () => {
    const second = botIds[1];
    if (second === undefined) throw new Error('봇이 없어요');

    await expect(
      fund.rebudget(second, { budgetType: 'fixed', budgetAmount: 5_000_000 }),
    ).resolves.toEqual({ ok: false, error: 'BUDGET_INSUFFICIENT' });

    const rows = await active();
    expect(rows.find(({ botId }) => botId === second)?.amount).toBe(200_000);
    await expect(
      dataSource.getRepository(Bot).findOneByOrFail({ id: second }),
    ).resolves.toMatchObject({ budgetType: 'ratio', budgetAmount: null });
  });

  it('쉬는 중인 봇은 기존 배분을 반환하고 새 금액으로 다시 확정해요', async () => {
    const second = botIds[1];
    if (second === undefined) throw new Error('봇이 없어요');

    await expect(
      fund.rebudget(second, { budgetType: 'fixed', budgetAmount: 250_000 }),
    ).resolves.toEqual({ ok: true });

    const history = await dataSource.getRepository(Allocation).find({
      where: { botId: second },
      order: { id: 'ASC' },
      take: 10,
    });
    expect(
      history.map(({ amount, releasedAmount }) => [amount, releasedAmount]),
    ).toEqual([
      [200_000, 200_000],
      [250_000, null],
    ]);
    await expect(
      dataSource.getRepository(Bot).findOneByOrFail({ id: second }),
    ).resolves.toMatchObject({
      budgetType: 'fixed',
      budgetRatio: null,
      budgetAmount: 250_000,
    });
  });
});
