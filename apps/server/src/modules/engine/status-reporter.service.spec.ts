import { Test } from '@nestjs/testing';

import { AccountSyncService } from '@/modules/account/index.js';
import { EngineStatusService } from '@/modules/engine-state/index.js';
import { MarketCollectorService } from '@/modules/market-data/index.js';

import { StatusReporterService } from './status-reporter.service.js';

describe('StatusReporterService', () => {
  const status = { write: vi.fn<EngineStatusService['write']>() };
  const marketCollector = {
    staleSymbols: vi.fn<MarketCollectorService['staleSymbols']>(),
  };
  const accountSync = {
    lastSyncedAt: vi.fn<AccountSyncService['lastSyncedAt']>(),
  };
  let reporter: StatusReporterService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    marketCollector.staleSymbols.mockReturnValue(['005930']);
    const moduleRef = await Test.createTestingModule({
      providers: [
        StatusReporterService,
        { provide: EngineStatusService, useValue: status },
        { provide: MarketCollectorService, useValue: marketCollector },
        { provide: AccountSyncService, useValue: accountSync },
      ],
    }).compile();
    reporter = moduleRef.get(StatusReporterService);
  });

  afterEach(() => {
    reporter.stop();
    vi.useRealTimers();
  });

  it('시작하자마자 쓰고 5초마다 다시 써요', async () => {
    const syncedAt = new Date('2026-10-29T01:00:00Z');
    accountSync.lastSyncedAt.mockReturnValue(syncedAt);

    reporter.start();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(status.write).toHaveBeenCalledTimes(3);
    expect(status.write).toHaveBeenLastCalledWith({
      staleSymbols: ['005930'],
      accountSyncedAt: syncedAt,
    });
  });

  it('아직 재동기화하지 않았으면 null로 써요', async () => {
    await reporter.report();

    expect(status.write).toHaveBeenCalledWith({
      staleSymbols: ['005930'],
      accountSyncedAt: null,
    });
  });

  it('쓰기가 실패해도 던지지 않아요', async () => {
    status.write.mockRejectedValue(new Error('db down'));

    await expect(reporter.report()).resolves.toBeUndefined();
  });
});
