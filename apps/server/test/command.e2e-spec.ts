import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { EngineLock } from '@/infra/database/engine-lock.js';
import { EngineLockModule } from '@/infra/database/engine-lock.module.js';
import { Bot } from '@/modules/bot/index.js';
import {
  Command,
  CommandModule,
  CommandService,
} from '@/modules/command/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { RiskEvent } from '@/modules/risk/index.js';

import { FakeTossModule } from './setup/fake-toss.js';
import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// POST /v1/commands가 commands에 넣고 같은 트랜잭션에서 NOTIFY하면 engine이 바로 처리하는지 실제 Postgres로 확인해요 (ADR-0004, NFR-02).
describe('명령 처리 (e2e)', () => {
  // 킬 스위치는 1초 안에 신규 진입을 막아야 해요 (NFR-02)
  const KILL_DEADLINE_MS = 1000;
  let app: INestApplication;
  let dataSource: DataSource;
  let engineState: EngineStateService;
  let botId: number;

  // web이 하는 것: POST /v1/commands
  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/v1/commands')
      .set('Authorization', bearer(app))
      .send(body);
  const send = async (body: Record<string, unknown>): Promise<void> => {
    await post(body).expect(201);
  };
  const handled = (id: number) =>
    dataSource.getRepository(Command).findOneByOrFail({ id });

  beforeAll(async () => {
    app = await createTestApp([
      FakeTossModule,
      EngineLockModule,
      CommandModule,
    ]);
    dataSource = app.get(DataSource);
    engineState = app.get(EngineStateService);
    await resetDatabase(app);
    const bot = await dataSource.getRepository(Bot).save({
      name: 'scalper',
      type: 'scalping',
      riskProfile: 'neutral',
      status: 'running',
      budgetType: 'fixed',
      budgetAmount: 1_000_000,
      startPriority: 1,
      tradingStart: '09:00',
      tradingEnd: '15:00',
      periodStart: '2026-10-29',
      onPeriodEnd: 'liquidate',
    });
    botId = bot.id;
    // LISTEN은 engine 잠금 연결에서 해요
    await app.get(EngineLock).acquire(() => undefined);
    await app.get(CommandService).start();
  });

  afterAll(async () => {
    app.get(CommandService).stop();
    await app.get(EngineLock).release();
    await app.close();
  });

  it('NOTIFY를 받으면 1초 안에 킬 스위치를 처리해 봇을 멈추고 기록을 남겨요', async () => {
    const sentAt = Date.now();
    await send({ kind: 'kill' });

    await vi.waitFor(
      () => {
        expect(engineState.canEnter(botId)).toBe(false);
      },
      { timeout: KILL_DEADLINE_MS, interval: 20 },
    );
    expect(Date.now() - sentAt).toBeLessThan(KILL_DEADLINE_MS);

    await vi.waitFor(async () => {
      await expect(handled(1)).resolves.toMatchObject({ result: 'ok' });
    });
    await expect(
      dataSource.getRepository(Bot).findOneByOrFail({ id: botId }),
    ).resolves.toMatchObject({
      status: 'stopped',
      statusReason: 'kill_switch',
    });
    await expect(
      dataSource.getRepository(RiskEvent).countBy({ kind: 'kill_switch' }),
    ).resolves.toBe(1);
  });

  it('resume하면 봇을 다시 돌리고 전체 정지를 풀어요', async () => {
    await send({ kind: 'resume', botId: String(botId) });

    await vi.waitFor(async () => {
      await expect(handled(2)).resolves.toMatchObject({ result: 'ok' });
    });
    expect(engineState.canEnter(botId)).toBe(true);
    await expect(
      dataSource.getRepository(Bot).findOneByOrFail({ id: botId }),
    ).resolves.toMatchObject({ status: 'running', statusReason: null });
  });

  it('GET /v1/commands/:id로 처리 결과를 확인해요', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/commands/1')
      .set('Authorization', bearer(app))
      .expect(200);

    expect(response.body).toMatchObject({
      id: '1',
      kind: 'kill',
      botId: null,
      liquidateAll: false,
      result: 'ok',
      error: null,
    });
    expect(response.body).toHaveProperty('handledAt');
    await request(app.getHttpServer())
      .get('/v1/commands/99')
      .set('Authorization', bearer(app))
      .expect(404);
  });

  it('봇 명령에 봇 id가 없으면 400, 없는 봇이면 404이고 행을 넣지 않아요', async () => {
    const missing = await post({ kind: 'pause' }).expect(400);
    expect(missing.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    const unknown = await post({ kind: 'pause', botId: '999' }).expect(404);
    expect(unknown.body).toMatchObject({ code: 'BOT_NOT_FOUND' });

    await expect(dataSource.getRepository(Command).count()).resolves.toBe(2);
  });

  it('멈춘(stopped) 봇의 pause는 409예요', async () => {
    await dataSource
      .getRepository(Bot)
      .update({ id: botId }, { status: 'stopped', statusReason: 'liquidate' });

    const response = await post({ kind: 'pause', botId: String(botId) }).expect(
      409,
    );

    expect(response.body).toMatchObject({ code: 'COMMAND_NOT_ALLOWED' });
  });
});
