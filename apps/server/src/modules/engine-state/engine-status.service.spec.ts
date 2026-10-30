import { Test } from '@nestjs/testing';

import {
  type MarketCalendar,
  MarketCalendarQueryService,
} from '@/modules/market-data/index.js';

import { EngineStateService } from './engine-state.service.js';
import { EngineStatusRepository } from './engine-status.repository.js';
import { EngineStatusService } from './engine-status.service.js';
import type { EngineStatus } from './entities/engine-status.entity.js';

describe('EngineStatusService', () => {
  const statuses = {
    save: vi.fn<EngineStatusRepository['save']>(),
    findCurrent: vi.fn<EngineStatusRepository['findCurrent']>(),
  };
  const calendars = {
    findDay: vi.fn<MarketCalendarQueryService['findDay']>(),
  };
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
        { provide: MarketCalendarQueryService, useValue: calendars },
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

  it('화면용으로 engine이 쓴 상태와 오늘(KST) 장 일정을 같이 읽어요', async () => {
    const status = Object.assign({ state: 'running' }) as EngineStatus;
    const today = Object.assign({ tradeDate: '2026-10-29' }) as MarketCalendar;
    statuses.findCurrent.mockResolvedValue(status);
    calendars.findDay.mockResolvedValue(today);

    await expect(service.current()).resolves.toEqual({ status, today });
    expect(calendars.findDay).toHaveBeenCalledWith('2026-10-29');
  });

  it('engine이 한 번도 쓰지 않았으면 404예요', async () => {
    statuses.findCurrent.mockResolvedValue(null);
    calendars.findDay.mockResolvedValue(null);

    await expect(service.current()).rejects.toMatchObject({
      code: 'ENGINE_STATUS_NOT_FOUND',
    });
  });
});
