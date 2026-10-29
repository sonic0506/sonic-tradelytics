import { type INestApplication, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { BatchRunRepository } from '@/modules/engine/batch-run.repository.js';
import { BatchRun } from '@/modules/engine/entities/batch-run.entity.js';
import {
  EngineStateModule,
  EngineStateService,
  EngineStatus,
  EngineStatusService,
} from '@/modules/engine-state/index.js';
import { RiskEvent, RiskModule, RiskService } from '@/modules/risk/index.js';

import { createTestApp, resetDatabase } from './setup/test-app.js';

// EngineScheduleService는 TossClient(engine 전용)에 기대서, 저장 부분만 실제 Postgres로 확인해요.
@Module({
  imports: [TypeOrmModule.forFeature([BatchRun])],
  providers: [BatchRunRepository],
})
class BatchStorageModule {}

// engine이 남기는 기록(알림 발송, 화면용 상태, 배치 실행)을 실제 Postgres 제약·트리거로 확인해요.
describe('engine 기록 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp([
      BatchStorageModule,
      EngineStateModule,
      RiskModule,
    ]);
    dataSource = app.get(DataSource);
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('알린 risk_event는 notified_at이 한 번만 채워지고, 다음 조회에서 빠져요', async () => {
    const risk = app.get(RiskService);
    await risk.record('kill_switch', null, { commandId: 1 });
    const [event] = await risk.findUnnotified(20);
    if (!event) throw new Error('이벤트가 없어요');

    await risk.markNotified(event.id);
    // 두 번째 기록은 조건(notified_at IS NULL)에 걸려 아무 행도 바꾸지 않아요(트리거가 막지 않아요)
    await risk.markNotified(event.id);

    await expect(risk.findUnnotified(20)).resolves.toEqual([]);
    const saved = await dataSource
      .getRepository(RiskEvent)
      .findOneByOrFail({ id: event.id });
    expect(saved.notifiedAt).not.toBeNull();
  });

  it('engine_statuses는 한 행을 덮어써요', async () => {
    const status = app.get(EngineStatusService);
    await status.write({ staleSymbols: [], accountSyncedAt: null });
    app.get(EngineStateService).halt('kill');
    await status.write({
      staleSymbols: ['005930'],
      accountSyncedAt: new Date('2026-10-29T01:00:00Z'),
    });

    const rows = await dataSource
      .getRepository(EngineStatus)
      .find({ take: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      state: 'halted',
      haltReasons: ['kill'],
      staleSymbols: ['005930'],
    });
  });

  it('실패한 배치를 다시 돌리면 같은 행을 새로 시작해요', async () => {
    const runs = app.get(BatchRunRepository);
    const key = { job: 'pre_open' as const, tradeDate: '2026-10-29', slot: '' };
    await runs.start(key, new Date('2026-10-28T23:30:00Z'));
    await runs.finish(key, 'failed', 'toss down');

    await runs.start(key, new Date('2026-10-28T23:35:00Z'));
    await runs.finish(key, 'ok', null);

    const rows = await dataSource.getRepository(BatchRun).find({ take: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ result: 'ok', error: null });
  });
});
