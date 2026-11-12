import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Bot } from '@/modules/bot/index.js';
import { BrokerOrder } from '@/modules/order/index.js';
import { Position } from '@/modules/position/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// 체결된 주문 목록 (api.md GET /v1/orders)
describe('GET /v1/orders (e2e)', () => {
  let app: INestApplication;
  let botId: number;
  let botPositionId: number;
  const get = (query = '') =>
    request(app.getHttpServer())
      .get(`/v1/orders${query}`)
      .set('Authorization', bearer(app));

  beforeAll(async () => {
    app = await createTestApp();
    const dataSource = app.get(DataSource);
    await resetDatabase(app);
    const bot = await dataSource.getRepository(Bot).save({
      name: 'day',
      type: 'day' as const,
      riskProfile: 'neutral' as const,
      status: 'running' as const,
      budgetType: 'fixed' as const,
      budgetAmount: 100_000,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      periodStart: '2026-11-09',
      onPeriodEnd: 'liquidate' as const,
      startPriority: 1,
    });
    botId = bot.id;
    const opened = new Date('2026-11-10T09:00:00+09:00');
    const [botPosition, manualPosition] = await dataSource
      .getRepository(Position)
      .save([
        {
          botId,
          symbol: '005930',
          status: 'open' as const,
          quantity: 1,
          openedAt: opened,
        },
        {
          botId: null,
          symbol: '000660',
          status: 'open' as const,
          quantity: 1,
          openedAt: opened,
        },
      ]);
    if (!botPosition || !manualPosition)
      throw new Error('포지션을 만들지 못했어요');
    botPositionId = botPosition.id;
    const order = (
      fields: Partial<BrokerOrder> & Pick<BrokerOrder, 'brokerOrderId'>,
    ) => ({
      origin: 'protective' as const,
      positionId: botPosition.id,
      symbol: '005930',
      side: 'SELL' as const,
      orderType: 'MARKET' as const,
      timeInForce: 'DAY' as const,
      quantity: 1,
      status: 'FILLED',
      filledQuantity: 1,
      avgFilledPrice: 70_000,
      filledAt: new Date('2026-11-10T10:00:00+09:00'),
      ...fields,
    });
    await dataSource.getRepository(BrokerOrder).save([
      order({ brokerOrderId: 'p-1' }),
      order({
        brokerOrderId: 'p-2',
        filledAt: new Date('2026-11-11T10:00:00+09:00'),
      }),
      order({
        brokerOrderId: 'm-1',
        origin: 'manual',
        positionId: manualPosition.id,
        symbol: '000660',
        side: 'BUY',
      }),
      // 체결 수량 0인 주문은 어떤 쿼리로도 나오지 않아요
      order({
        brokerOrderId: 'p-3',
        status: 'CANCELED',
        filledQuantity: 0,
        avgFilledPrice: null,
        filledAt: null,
      }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('기본으로 봇 주문만 마지막 체결 최신순으로 줘요', async () => {
    const response = await get().expect(200);

    expect(response.body.meta).toMatchObject({ total: 2 });
    expect(response.body.items).toEqual([
      expect.objectContaining({
        filledAt: '2026-11-11T01:00:00.000Z',
        botName: 'day',
      }),
      {
        id: expect.any(String),
        filledAt: '2026-11-10T01:00:00.000Z',
        symbolCode: '005930',
        symbolName: '005930',
        botName: 'day',
        side: 'SELL',
        filledQuantity: 1,
        avgFillPrice: 70_000,
        origin: 'protective',
        positionId: String(botPositionId),
      },
    ]);
  });

  it('출처·거래일·봇으로 거를 수 있어요', async () => {
    const manual = await get('?origins=manual').expect(200);
    expect(manual.body.items).toEqual([
      expect.objectContaining({ origin: 'manual', botName: null }),
    ]);

    const day = await get(
      `?from=2026-11-10&to=2026-11-10&botIds=${botId}`,
    ).expect(200);
    expect(day.body.meta).toMatchObject({ total: 1 });
  });

  it('모르는 출처는 400이에요', async () => {
    await get('?origins=robot').expect(400);
  });
});
