import { Test } from '@nestjs/testing';

import { EngineStateService } from './engine-state.service.js';
import { EngineStatusRepository } from './engine-status.repository.js';
import { EngineStatusService } from './engine-status.service.js';

describe('EngineStatusService', () => {
  const statuses = { save: vi.fn<EngineStatusRepository['save']>() };
  const now = new Date('2026-10-29T01:00:00Z');
  let state: EngineStateService;
  let service: EngineStatusService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now, toFake: ['Date'] });
    const moduleRef = await Test.createTestingModule({
      providers: [
        EngineStatusService,
        EngineStateService,
        { provide: EngineStatusRepository, useValue: statuses },
      ],
    }).compile();
    service = moduleRef.get(EngineStatusService);
    state = moduleRef.get(EngineStateService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('지금의 정지 상태와 받은 값을 heartbeat와 함께 써요', async () => {
    state.halt('kill');
    const syncedAt = new Date('2026-10-29T00:59:30Z');

    await service.write({
      staleSymbols: ['005930'],
      accountSyncedAt: syncedAt,
    });

    expect(statuses.save).toHaveBeenCalledWith({
      state: 'halted',
      haltReasons: ['kill'],
      staleSymbols: ['005930'],
      orderableCash: null,
      holdingsValue: null,
      accountSyncedAt: syncedAt,
      heartbeatAt: now,
    });
  });
});
