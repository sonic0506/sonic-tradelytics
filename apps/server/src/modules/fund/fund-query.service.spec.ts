import { Test } from '@nestjs/testing';

import type { AccountSnapshot } from '@/modules/account/index.js';
import { OrderQueryService } from '@/modules/order/index.js';
import { PositionService } from '@/modules/position/index.js';

import { AllocationRepository } from './allocation.repository.js';
import type { Allocation } from './entities/allocation.entity.js';
import { FundQueryService } from './fund-query.service.js';

describe('FundQueryService', () => {
  const allocations = {
    findActiveByBots: vi.fn<AllocationRepository['findActiveByBots']>(),
  };
  const positions = { botHoldings: vi.fn<PositionService['botHoldings']>() };
  const orders = {
    openOrdersByBot: vi.fn<OrderQueryService['openOrdersByBot']>(),
  };
  let service: FundQueryService;
  const allocatedAt = new Date('2026-10-30T23:59:00Z');

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FundQueryService,
        { provide: AllocationRepository, useValue: allocations },
        { provide: PositionService, useValue: positions },
        { provide: OrderQueryService, useValue: orders },
      ],
    }).compile();
    service = moduleRef.get(FundQueryService);
  });

  it('봇 화면 자금 정보: 사용 중 금액·남은 한도·현금 몫과 확정 때 운용 자산을 모아요', async () => {
    allocations.findActiveByBots.mockResolvedValue([
      Object.assign({
        botId: 7,
        amount: 100_000,
        createdAt: allocatedAt,
        snapshot: Object.assign({
          availableCapital: 210_000,
        }) as AccountSnapshot,
      }) as Allocation,
    ]);
    positions.botHoldings.mockResolvedValue(
      new Map([
        [7, { holdingsCost: 40_000, realizedPnl: 1_500, hasHoldings: true }],
      ]),
    );
    orders.openOrdersByBot.mockResolvedValue(
      new Map([[7, { openBuyAmount: 20_000, hasOpenOrders: true }]]),
    );

    const views = await service.viewsOf([7, 8]);

    expect(views.get(7)).toEqual({
      amount: 100_000,
      realizedPnl: 1_500,
      holdingsCost: 40_000,
      openBuyAmount: 20_000,
      hasHoldings: true,
      hasOpenOrders: true,
      allocatedAt,
      capitalAtAllocation: 210_000,
      usedAmount: 60_000,
      remainingBudget: 40_000,
      cashShare: 41_500,
    });
    // 확정 전인 봇은 빠져요
    expect(views.has(8)).toBe(false);
  });

  it('봇이 없으면 조회하지 않아요', async () => {
    await expect(service.viewsOf([])).resolves.toEqual(new Map());
    expect(allocations.findActiveByBots).not.toHaveBeenCalled();
  });

  it('누적 손실 한도까지 남은 여유는 한도 금액에서 손실을 뺀 값이에요', () => {
    // 10만 원의 -10% = 10,000원, 지금 -3,000원
    expect(service.lossRoom(100_000, 10, -3_000)).toBe(7_000);
  });
});
