import { Test } from '@nestjs/testing';

import {
  type AccountSnapshot,
  AccountSnapshotService,
} from '@/modules/account/index.js';
import {
  type Bot,
  BotService,
  type BotVersion,
  type BotWithVersion,
} from '@/modules/bot/index.js';
import { OrderService } from '@/modules/order/index.js';
import { PositionService } from '@/modules/position/index.js';
import { RiskService } from '@/modules/risk/index.js';

import { noOpTransactionalModule } from '../../../test/setup/transactional.js';
import { AllocationRepository } from './allocation.repository.js';
import type { Allocation } from './entities/allocation.entity.js';
import { FundRatioExceededException } from './fund.exception.js';
import { FundService } from './fund.service.js';

describe('FundService', () => {
  const allocations = {
    findActive: vi.fn<AllocationRepository['findActive']>(),
    findActiveByBot: vi.fn<AllocationRepository['findActiveByBot']>(),
    add: vi.fn<AllocationRepository['add']>(),
    release: vi.fn<AllocationRepository['release']>(),
  };
  const snapshots = { take: vi.fn<AccountSnapshotService['take']>() };
  const bots = {
    findWithVersions: vi.fn<BotService['findWithVersions']>(),
    setStatus: vi.fn<BotService['setStatus']>(),
    updateBudget: vi.fn<BotService['updateBudget']>(),
  };
  const positions = { botHoldings: vi.fn<PositionService['botHoldings']>() };
  const orders = { openOrdersByBot: vi.fn<OrderService['openOrdersByBot']>() };
  const risk = { record: vi.fn<RiskService['record']>() };
  let service: FundService;

  // 2026-10-29 17:00 KST (봇 운영 시간 밖)
  const evening = new Date('2026-10-29T08:00:00Z');
  const created = new Date('2026-10-28T23:59:00Z');

  const bot = (id: number, fields: Partial<Bot> = {}): Bot =>
    Object.assign(
      {
        id,
        status: 'ready',
        statusReason: null,
        stage: 'released',
        budgetType: 'ratio',
        budgetRatio: 0.1,
        budgetAmount: null,
        startPriority: id,
        tradingStart: '09:00:00',
        tradingEnd: '15:30:00',
      },
      fields,
    ) as Bot;
  const version = (fields: Partial<BotVersion> = {}): BotVersion =>
    Object.assign(
      { orderSizeType: 'ratio', orderSizeValue: 0.1 },
      fields,
    ) as BotVersion;
  const target = (
    value: Bot,
    ver: BotVersion | null = version(),
  ): BotWithVersion => ({
    bot: value,
    version: ver,
  });
  const allocation = (botId: number, amount: number): Allocation =>
    Object.assign({
      id: botId * 10,
      botId,
      amount,
      createdAt: created,
    }) as Allocation;
  const snapshot = (availableCapital: number): AccountSnapshot =>
    Object.assign({ id: 55, availableCapital }) as AccountSnapshot;
  const holdings = (
    entries: [
      number,
      { holdingsCost: number; realizedPnl: number; hasHoldings: boolean },
    ][],
  ) => new Map(entries);
  const openOrders = (
    entries: [number, { openBuyAmount: number; hasOpenOrders: boolean }][],
  ) => new Map(entries);

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: evening, toFake: ['Date'] });
    allocations.findActive.mockResolvedValue([]);
    positions.botHoldings.mockResolvedValue(new Map());
    orders.openOrdersByBot.mockResolvedValue(new Map());
    const moduleRef = await Test.createTestingModule({
      imports: [noOpTransactionalModule],
      providers: [
        FundService,
        { provide: AllocationRepository, useValue: allocations },
        { provide: AccountSnapshotService, useValue: snapshots },
        { provide: BotService, useValue: bots },
        { provide: PositionService, useValue: positions },
        { provide: OrderService, useValue: orders },
        { provide: RiskService, useValue: risk },
      ],
    }).compile();
    service = moduleRef.get(FundService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('allocate', () => {
    it('실행 중 봇들의 현금 몫을 빼고 한 스냅샷으로 같이 시작하는 봇들을 확정해요', async () => {
      // 실행 중 봇 9: 투자금 20만, 보유 5만, 실현 +1만 → 현금 몫 16만
      allocations.findActive.mockResolvedValue([allocation(9, 200_000)]);
      positions.botHoldings.mockResolvedValue(
        holdings([
          [9, { holdingsCost: 50_000, realizedPnl: 10_000, hasHoldings: true }],
        ]),
      );
      bots.findWithVersions.mockResolvedValue([
        target(bot(1, { budgetRatio: 0.1 })),
        target(bot(2, { budgetRatio: 0.2 })),
      ]);
      snapshots.take.mockResolvedValue(snapshot(1_000_000));

      const outcomes = await service.allocate([1, 2]);

      expect(snapshots.take).toHaveBeenCalledWith(160_000);
      expect(allocations.add).toHaveBeenCalledWith([
        { botId: 1, snapshotId: 55, amount: 100_000, capped: false },
        { botId: 2, snapshotId: 55, amount: 200_000, capped: false },
      ]);
      expect(outcomes).toHaveLength(2);
    });

    it('이미 배분이 있는 봇은 다시 확정하지 않아요', async () => {
      allocations.findActive.mockResolvedValue([allocation(1, 100_000)]);
      bots.findWithVersions.mockResolvedValue([]);

      await expect(service.allocate([1])).resolves.toEqual([]);
      expect(bots.findWithVersions).toHaveBeenCalledWith([]);
      expect(snapshots.take).not.toHaveBeenCalled();
    });

    it('같이 시작하는 봇들의 정률 합이 100%를 넘으면 스냅샷 없이 거부해요', async () => {
      bots.findWithVersions.mockResolvedValue([
        target(bot(1, { budgetRatio: 0.6 })),
        target(bot(2, { budgetRatio: 0.5 })),
      ]);

      await expect(service.allocate([1, 2])).rejects.toThrow(
        FundRatioExceededException,
      );
      expect(snapshots.take).not.toHaveBeenCalled();
    });

    it('보류된 봇은 자금 대기로 바꾸고 처음 한 번만 알려요', async () => {
      bots.findWithVersions.mockResolvedValue([
        target(
          bot(1, {
            budgetType: 'fixed',
            budgetRatio: null,
            budgetAmount: 80_000,
          }),
        ),
        target(
          bot(2, {
            budgetType: 'fixed',
            budgetRatio: null,
            budgetAmount: 80_000,
            status: 'waiting_funds',
            statusReason: 'insufficient_funds',
          }),
        ),
      ]);
      snapshots.take.mockResolvedValue(snapshot(50_000));

      await service.allocate([1, 2]);

      expect(bots.setStatus).toHaveBeenCalledExactlyOnceWith(
        1,
        'waiting_funds',
        'insufficient_funds',
      );
      expect(risk.record).toHaveBeenCalledExactlyOnceWith('funds_waiting', 1, {
        reason: 'insufficient_funds',
      });
      expect(allocations.add).toHaveBeenCalledWith([]);
    });

    it('자금 대기였던 봇이 확정되면 다시 running이에요', async () => {
      bots.findWithVersions.mockResolvedValue([
        target(
          bot(1, {
            status: 'waiting_funds',
            statusReason: 'insufficient_funds',
          }),
        ),
      ]);
      snapshots.take.mockResolvedValue(snapshot(1_000_000));

      await service.allocate([1]);

      expect(bots.setStatus).toHaveBeenCalledWith(1, 'running', null);
    });

    it('검증 구간 봇은 상한까지만, 1회 주문 금액이 정액이면 그보다 작을 때 보류해요', async () => {
      bots.findWithVersions.mockResolvedValue([
        target(bot(1, { stage: 'verifying', budgetRatio: 0.5 })),
        target(
          bot(2, { budgetRatio: 0.01 }),
          version({ orderSizeType: 'fixed', orderSizeValue: 50_000 }),
        ),
      ]);
      snapshots.take.mockResolvedValue(snapshot(1_000_000));

      const outcomes = await service.allocate([1, 2]);

      expect(outcomes).toEqual([
        { botId: 1, status: 'allocated', amount: 100_000, capped: true },
        { botId: 2, status: 'waiting', reason: 'below_order_size' },
      ]);
    });
  });

  describe('release', () => {
    it('보유·미체결이 없으면 손익을 포함한 금액을 반환해요', async () => {
      allocations.findActiveByBot.mockResolvedValue(allocation(1, 100_000));
      positions.botHoldings.mockResolvedValue(
        holdings([
          [1, { holdingsCost: 0, realizedPnl: 20_000, hasHoldings: false }],
        ]),
      );

      await expect(service.release(1)).resolves.toBe(120_000);
      expect(allocations.release).toHaveBeenCalledWith(10, 120_000, evening);
    });

    it('보유 종목이나 미체결 주문이 있으면 반환하지 않아요', async () => {
      allocations.findActiveByBot.mockResolvedValue(allocation(1, 100_000));
      orders.openOrdersByBot.mockResolvedValue(
        openOrders([[1, { openBuyAmount: 10_000, hasOpenOrders: true }]]),
      );

      await expect(service.release(1)).resolves.toBeNull();
      expect(allocations.release).not.toHaveBeenCalled();
    });

    it('배분이 없으면 null이에요', async () => {
      allocations.findActiveByBot.mockResolvedValue(null);

      await expect(service.release(1)).resolves.toBeNull();
    });
  });

  describe('rebudget', () => {
    const running = bot(1, {
      status: 'running',
      budgetType: 'fixed',
      budgetRatio: null,
      budgetAmount: 100_000,
    });

    beforeEach(() => {
      bots.findWithVersions.mockResolvedValue([target(running)]);
      allocations.findActiveByBot.mockResolvedValue(allocation(1, 100_000));
      allocations.findActive.mockResolvedValue([
        allocation(1, 100_000),
        allocation(2, 300_000),
      ]);
      positions.botHoldings.mockResolvedValue(
        holdings([
          [1, { holdingsCost: 0, realizedPnl: 30_000, hasHoldings: false }],
          [2, { holdingsCost: 100_000, realizedPnl: 0, hasHoldings: true }],
        ]),
      );
      snapshots.take.mockResolvedValue(snapshot(1_000_000));
    });

    it('쉬는 중이면 손익 포함 금액을 반환하고 다른 봇 현금 몫만 뺀 스냅샷으로 다시 확정해요', async () => {
      await expect(
        service.rebudget(1, { budgetType: 'ratio', budgetRatio: 0.3 }),
      ).resolves.toEqual({ ok: true });

      // 봇 2의 현금 몫 = 30만 − 10만 = 20만
      expect(snapshots.take).toHaveBeenCalledWith(200_000);
      expect(allocations.release).toHaveBeenCalledWith(10, 130_000, evening);
      expect(allocations.add).toHaveBeenCalledWith([
        { botId: 1, snapshotId: 55, amount: 300_000, capped: false },
      ]);
      expect(bots.updateBudget).toHaveBeenCalledWith(1, {
        budgetType: 'ratio',
        budgetRatio: 0.3,
        budgetAmount: null,
      });
    });

    it('새 금액을 확정할 운용 자산이 모자라면 기존 투자금을 그대로 둬요', async () => {
      snapshots.take.mockResolvedValue(snapshot(50_000));

      await expect(
        service.rebudget(1, { budgetType: 'fixed', budgetAmount: 100_000 }),
      ).resolves.toEqual({ ok: false, error: 'BUDGET_INSUFFICIENT' });
      expect(allocations.release).not.toHaveBeenCalled();
      expect(allocations.add).not.toHaveBeenCalled();
      expect(bots.updateBudget).not.toHaveBeenCalled();
    });

    it.each([
      [
        '보유 종목이 있으면',
        { holdingsCost: 50_000, realizedPnl: 0, hasHoldings: true },
        { openBuyAmount: 0, hasOpenOrders: false },
        'BOT_NOT_RESTING:holding',
      ],
      [
        '미체결 주문이 있으면',
        { holdingsCost: 0, realizedPnl: 0, hasHoldings: false },
        { openBuyAmount: 0, hasOpenOrders: true },
        'BOT_NOT_RESTING:pending_order',
      ],
    ])('%s 쉬는 중이 아니라서 거부해요', async (_, held, open, error) => {
      positions.botHoldings.mockResolvedValue(holdings([[1, held]]));
      orders.openOrdersByBot.mockResolvedValue(openOrders([[1, open]]));

      await expect(
        service.rebudget(1, { budgetType: 'fixed', budgetAmount: 50_000 }),
      ).resolves.toEqual({ ok: false, error });
      expect(snapshots.take).not.toHaveBeenCalled();
    });

    it('봇 운영 시간 안이면 쉬는 중이 아니라서 거부해요', async () => {
      // 10:00 KST
      vi.setSystemTime(new Date('2026-10-29T01:00:00Z'));

      await expect(
        service.rebudget(1, { budgetType: 'fixed', budgetAmount: 50_000 }),
      ).resolves.toEqual({ ok: false, error: 'BOT_NOT_RESTING:trading_hours' });
    });

    it.each([
      ['설정 모양이 틀리면', { budgetType: 'fixed' }, 'INVALID_BUDGET'],
      [
        '1회 주문 금액을 바꾸려 하면',
        { budgetType: 'fixed', budgetAmount: 50_000, orderSizeValue: 0.2 },
        'ORDER_SIZE_CHANGE_UNSUPPORTED',
      ],
    ])('%s 거부해요', async (_, budget, error) => {
      await expect(service.rebudget(1, budget)).resolves.toEqual({
        ok: false,
        error,
      });
    });

    it('실행 중이나 일시정지가 아닌 봇은 거부해요', async () => {
      bots.findWithVersions.mockResolvedValue([
        target(bot(1, { status: 'ready' })),
      ]);

      await expect(
        service.rebudget(1, { budgetType: 'fixed', budgetAmount: 50_000 }),
      ).resolves.toEqual({ ok: false, error: 'BOT_NOT_RUNNING' });
    });

    it('봇이나 배분이 없으면 거부해요', async () => {
      allocations.findActiveByBot.mockResolvedValue(null);
      await expect(
        service.rebudget(1, { budgetType: 'fixed', budgetAmount: 50_000 }),
      ).resolves.toEqual({ ok: false, error: 'NO_ALLOCATION' });

      bots.findWithVersions.mockResolvedValue([]);
      await expect(
        service.rebudget(1, { budgetType: 'fixed', budgetAmount: 50_000 }),
      ).resolves.toEqual({ ok: false, error: 'BOT_NOT_FOUND' });
    });
  });

  describe('진입 1회 금액', () => {
    it('정률이면 확정 투자금 × 비율에서 보유·미체결을 뺀 한도 안으로 줄여요', async () => {
      allocations.findActiveByBot.mockResolvedValue(allocation(7, 100_000));
      positions.botHoldings.mockResolvedValue(
        holdings([
          [7, { holdingsCost: 85_000, realizedPnl: 0, hasHoldings: true }],
        ]),
      );

      await expect(
        service.entryBudget(7, { type: 'ratio', value: 0.2 }),
      ).resolves.toBe(14_985);
      await expect(
        service.entryBudget(7, { type: 'fixed', value: 10_000 }),
      ).resolves.toBe(9_990);
    });

    it('확정 투자금이 없으면 0이에요', async () => {
      allocations.findActiveByBot.mockResolvedValue(null);

      await expect(
        service.entryBudget(7, { type: 'fixed', value: 10_000 }),
      ).resolves.toBe(0);
    });
  });
});
