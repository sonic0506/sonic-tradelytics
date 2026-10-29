import { Test } from '@nestjs/testing';

import type { RiskEvent } from './entities/risk-event.entity.js';
import { RiskRepository } from './risk.repository.js';
import { RiskService } from './risk.service.js';

describe('RiskService', () => {
  const events = {
    add: vi.fn<RiskRepository['add']>(),
    findLatest: vi.fn<RiskRepository['findLatest']>(),
    findUnnotified: vi.fn<RiskRepository['findUnnotified']>(),
    markNotified: vi.fn<RiskRepository['markNotified']>(),
  };
  let service: RiskService;
  const now = new Date('2026-10-29T01:00:00Z');

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now, toFake: ['Date'] });
    const moduleRef = await Test.createTestingModule({
      providers: [RiskService, { provide: RiskRepository, useValue: events }],
    }).compile();
    service = moduleRef.get(RiskService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('이벤트를 지금 시각으로 기록해요', async () => {
    await service.record('kill_switch', null, { commandId: 1 });

    expect(events.add).toHaveBeenCalledWith({
      kind: 'kill_switch',
      botId: null,
      occurredAt: now,
      detail: { commandId: 1 },
    });
  });

  it('알릴 이벤트를 찾고 지금 시각으로 알림을 남겨요', async () => {
    events.findUnnotified.mockResolvedValue([]);

    await service.findUnnotified(20);
    await service.markNotified(3);

    expect(events.findUnnotified).toHaveBeenCalledWith(20);
    expect(events.markNotified).toHaveBeenCalledWith(3, now);
  });

  it('마지막 이벤트 시각을 돌려주고, 없으면 undefined예요', async () => {
    events.findLatest.mockResolvedValueOnce(
      Object.assign({ occurredAt: now }) as RiskEvent,
    );
    events.findLatest.mockResolvedValueOnce(null);

    await expect(service.latestAt('kill_switch')).resolves.toEqual(now);
    await expect(service.latestAt('kill_switch')).resolves.toBeUndefined();
  });
});
