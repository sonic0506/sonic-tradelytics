import { Test } from '@nestjs/testing';

import { TossClient } from '@/infra/toss/toss.client.js';
import { AccountSyncService } from '@/modules/account/index.js';
import { type Bot, BotService } from '@/modules/bot/index.js';
import { FundService } from '@/modules/fund/index.js';
import { MarketCalendarService } from '@/modules/market-data/index.js';
import { OrderService } from '@/modules/order/index.js';
import { RiskService } from '@/modules/risk/index.js';

import { BatchRunRepository } from './batch-run.repository.js';
import { EngineScheduleService } from './engine-schedule.service.js';
import type { BatchRun } from './entities/batch-run.entity.js';

describe('EngineScheduleService', () => {
  const runs = {
    find: vi.fn<BatchRunRepository['find']>(),
    start: vi.fn<BatchRunRepository['start']>(),
    finish: vi.fn<BatchRunRepository['finish']>(),
  };
  const calendar = {
    ensureToday: vi.fn<MarketCalendarService['ensureToday']>(),
  };
  const risk = {
    record: vi.fn<RiskService['record']>(),
    resumeDailyStops: vi.fn<RiskService['resumeDailyStops']>(),
  };
  const toss = { ensureToken: vi.fn<TossClient['ensureToken']>() };
  const accountSync = { syncAll: vi.fn<AccountSyncService['syncAll']>() };
  const orders = {
    scoreClosedPositions: vi.fn<OrderService['scoreClosedPositions']>(),
  };
  const bots = { findFundable: vi.fn<BotService['findFundable']>() };
  const fund = { allocate: vi.fn<FundService['allocate']>() };
  let schedule: EngineScheduleService;

  const MINUTE_MS = 60_000;
  // 2026-10-29(목) 10:00 KST
  const tenAm = new Date('2026-10-29T01:00:00Z');
  const tradingDay = (isOpen: boolean) => ({
    tradeDate: '2026-10-29',
    isOpen,
    regularOpenAt: null,
    regularCloseAt: null,
    fetchedAt: tenAm,
    createdAt: tenAm,
  });
  const finished = () =>
    runs.finish.mock.calls.map(([key, result]) => [key.job, result]);

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: tenAm });
    runs.find.mockResolvedValue(null);
    calendar.ensureToday.mockResolvedValue(tradingDay(true));
    bots.findFundable.mockResolvedValue([
      Object.assign({ id: 7 }) as Bot,
      Object.assign({ id: 8 }) as Bot,
    ]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        EngineScheduleService,
        { provide: BatchRunRepository, useValue: runs },
        { provide: MarketCalendarService, useValue: calendar },
        { provide: RiskService, useValue: risk },
        { provide: TossClient, useValue: toss },
        { provide: AccountSyncService, useValue: accountSync },
        { provide: OrderService, useValue: orders },
        { provide: BotService, useValue: bots },
        { provide: FundService, useValue: fund },
      ],
    }).compile();
    schedule = moduleRef.get(EngineScheduleService);
  });

  afterEach(() => {
    schedule.stop();
    vi.useRealTimers();
  });

  it('시작할 때 시각이 지난 배치(08:30 pre_open, 08:59 open_snapshot)만 따라잡아요', async () => {
    await schedule.start();

    expect(toss.ensureToken).toHaveBeenCalledOnce();
    expect(risk.resumeDailyStops).toHaveBeenCalledOnce();
    expect(accountSync.syncAll).not.toHaveBeenCalled();
    expect(runs.start).toHaveBeenCalledWith(
      { job: 'pre_open', tradeDate: '2026-10-29', slot: '' },
      tenAm,
    );
    expect(finished()).toEqual([
      ['pre_open', 'ok'],
      ['open_snapshot', 'ok'],
    ]);
    // 실행 중·자금 대기 봇의 투자금을 확정해요
    expect(fund.allocate).toHaveBeenCalledWith([7, 8]);
  });

  it('15:40에 post_close로 오늘 체결을 최종 동기화하고 판단을 채점해요', async () => {
    await schedule.start();

    await vi.advanceTimersByTimeAsync(339 * MINUTE_MS);
    expect(accountSync.syncAll).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    expect(accountSync.syncAll).toHaveBeenCalledOnce();
    expect(orders.scoreClosedPositions).toHaveBeenCalledOnce();
    expect(finished()).toContainEqual(['post_close', 'ok']);
  });

  it('다음 날 같은 시각에 다시 돌아요', async () => {
    await schedule.start();
    toss.ensureToken.mockClear();

    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE_MS);

    expect(toss.ensureToken).toHaveBeenCalledOnce();
  });

  it('오늘 이미 끝난 배치는 다시 돌리지 않아요', async () => {
    runs.find.mockResolvedValue(Object.assign({ result: 'ok' }) as BatchRun);

    await schedule.start();

    expect(toss.ensureToken).not.toHaveBeenCalled();
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('휴장일이면 skipped로 남기고 아무것도 하지 않아요', async () => {
    calendar.ensureToday.mockResolvedValue(tradingDay(false));

    await schedule.start();

    expect(toss.ensureToken).not.toHaveBeenCalled();
    expect(fund.allocate).not.toHaveBeenCalled();
    expect(finished()).toEqual([
      ['pre_open', 'skipped'],
      ['open_snapshot', 'skipped'],
    ]);
  });

  it('실패하면 failed와 batch_fail을 남기고 던지지 않아요', async () => {
    toss.ensureToken.mockRejectedValue(new Error('toss down'));

    await expect(schedule.start()).resolves.toBeUndefined();

    expect(runs.finish).toHaveBeenCalledWith(
      { job: 'pre_open', tradeDate: '2026-10-29', slot: '' },
      'failed',
      'Error: toss down',
    );
    expect(risk.record).toHaveBeenCalledWith('batch_fail', null, {
      job: 'pre_open',
      tradeDate: '2026-10-29',
      slot: '',
      error: 'Error: toss down',
    });
  });

  it('실패 기록마저 실패해도 던지지 않아요', async () => {
    toss.ensureToken.mockRejectedValue(new Error('toss down'));
    runs.finish.mockRejectedValue(new Error('db down'));

    await expect(schedule.start()).resolves.toBeUndefined();
  });

  it('장 마감 뒤에 시작하면 세 배치를 순서대로 따라잡아요', async () => {
    // 20:00 KST
    await schedule.start(new Date('2026-10-29T11:00:00Z'));

    expect(finished()).toEqual([
      ['pre_open', 'ok'],
      ['open_snapshot', 'ok'],
      ['post_close', 'ok'],
    ]);
  });
});
