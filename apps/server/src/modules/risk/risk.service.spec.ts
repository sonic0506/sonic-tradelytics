import { Test } from '@nestjs/testing';

import { type Bot, BotService } from '@/modules/bot/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';

import { noOpTransactionalModule } from '../../../test/setup/transactional.js';
import type { RiskEvent } from './entities/risk-event.entity.js';
import type { SymbolLock } from './entities/symbol-lock.entity.js';
import { RiskRepository } from './risk.repository.js';
import { RiskService } from './risk.service.js';
import { SymbolLockRepository } from './symbol-lock.repository.js';

describe('RiskService', () => {
  const events = {
    add: vi.fn<RiskRepository['add']>(),
    findLatest: vi.fn<RiskRepository['findLatest']>(),
    findUnnotified: vi.fn<RiskRepository['findUnnotified']>(),
    markNotified: vi.fn<RiskRepository['markNotified']>(),
  };
  const locks = {
    findActive: vi.fn<SymbolLockRepository['findActive']>(),
    add: vi.fn<SymbolLockRepository['add']>(),
    release: vi.fn<SymbolLockRepository['release']>(),
  };
  const bots = {
    findInactive: vi.fn<BotService['findInactive']>(),
    setStatus: vi.fn<BotService['setStatus']>(),
  };
  let state: EngineStateService;
  let service: RiskService;
  const now = new Date('2026-10-29T01:00:00Z');

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now, toFake: ['Date'] });
    const moduleRef = await Test.createTestingModule({
      imports: [noOpTransactionalModule],
      providers: [
        RiskService,
        EngineStateService,
        { provide: RiskRepository, useValue: events },
        { provide: SymbolLockRepository, useValue: locks },
        { provide: BotService, useValue: bots },
      ],
    }).compile();
    service = moduleRef.get(RiskService);
    state = moduleRef.get(EngineStateService);
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

  describe('종목 잠금 (POL-RISK-16)', () => {
    const lock = (botId: number): SymbolLock =>
      Object.assign({ symbol: '005930', botId }) as SymbolLock;

    it('아무도 잡지 않은 종목이면 잠금을 새로 잡아요', async () => {
      locks.findActive.mockResolvedValue(null);
      locks.add.mockResolvedValue(true);

      await expect(service.acquireLock('005930', 7)).resolves.toBe(true);
      expect(locks.add).toHaveBeenCalledWith('005930', 7, now);
    });

    it('이미 이 봇이 잡고 있으면(분할 매수) 그대로 통과해요', async () => {
      locks.findActive.mockResolvedValue(lock(7));

      await expect(service.acquireLock('005930', 7)).resolves.toBe(true);
      expect(locks.add).not.toHaveBeenCalled();
    });

    it('다른 봇이 잡고 있으면 진입하지 않아요', async () => {
      locks.findActive.mockResolvedValue(lock(8));

      await expect(service.acquireLock('005930', 7)).resolves.toBe(false);
    });

    it('동시에 잡으려다 DB가 막으면 진입하지 않아요', async () => {
      locks.findActive.mockResolvedValue(null);
      locks.add.mockResolvedValue(false);

      await expect(service.acquireLock('005930', 7)).resolves.toBe(false);
    });

    it('잠금을 지금 시각으로 풀어요', async () => {
      await service.releaseLock('005930', 7);

      expect(locks.release).toHaveBeenCalledWith('005930', 7, now);
    });
  });

  describe('한도에 걸린 봇 정지', () => {
    it.each([
      ['daily_stop', 'paused'],
      ['total_stop', 'stopped'],
      ['streak_pause', 'paused'],
      ['rate_cap', 'paused'],
    ] as const)(
      '%s면 봇을 %s로 바꾸고 신규 진입을 막고 기록해요',
      async (reason, status) => {
        await service.stopBot(7, reason, { dailyPnl: -4000 });

        expect(state.canEnter(7)).toBe(false);
        expect(bots.setStatus).toHaveBeenCalledWith(7, status, reason);
        expect(events.add).toHaveBeenCalledWith({
          kind: reason,
          botId: 7,
          occurredAt: now,
          detail: { dailyPnl: -4000 },
        });
      },
    );

    it('DB 기록이 실패해도 메모리에서는 이미 신규 진입을 막아요', async () => {
      bots.setStatus.mockRejectedValue(new Error('db down'));

      await expect(service.stopBot(7, 'daily_stop', {})).rejects.toThrow(
        'db down',
      );
      expect(state.canEnter(7)).toBe(false);
    });

    it('하루 손실로 멈춘 봇만 다음 거래일에 다시 돌려요', async () => {
      const bot = (id: number, status: string, statusReason: string) =>
        Object.assign({ id, status, statusReason }) as Bot;
      bots.findInactive.mockResolvedValue([
        bot(1, 'paused', 'daily_stop'),
        bot(2, 'paused', 'streak_pause'),
        bot(3, 'stopped', 'total_stop'),
      ]);
      state.blockBot(1, 'daily_stop');
      state.blockBot(2, 'streak_pause');

      await expect(service.resumeDailyStops()).resolves.toEqual([1]);

      expect(bots.setStatus).toHaveBeenCalledExactlyOnceWith(
        1,
        'running',
        null,
      );
      expect(state.canEnter(1)).toBe(true);
      expect(state.canEnter(2)).toBe(false);
    });
  });
});
