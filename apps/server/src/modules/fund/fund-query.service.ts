import { Injectable } from '@nestjs/common';

import { OrderQueryService } from '@/modules/order/index.js';
import { PositionService } from '@/modules/position/index.js';
import { lossLimit } from '@/modules/risk/index.js';

import { AllocationRepository } from './allocation.repository.js';
import { cashShare } from './allocation.rule.js';
import type { Allocation } from './entities/allocation.entity.js';
import type { BotFunds } from './fund.types.js';

// 봇 하나의 지금 돈 상태와 쉬는 중 판단에 쓰는 값
export type RunningFunds = BotFunds & {
  hasHoldings: boolean;
  hasOpenOrders: boolean;
};

// 봇 화면에 보여 줄 자금 정보 (docs/policy/fund-allocation.md 봇 화면에 표시할 자금 정보)
export interface BotFundsView extends RunningFunds {
  allocatedAt: Date;
  // 확정 때 운용 자산
  capitalAtAllocation: number;
  // 사용 중 금액 = 보유 매수 금액 + 미체결 매수 금액
  usedAmount: number;
  // 남은 한도 = 확정 투자금 − 사용 중 금액
  remainingBudget: number;
  cashShare: number;
}

// 배분·자금 상태를 읽기만 해요. 토스가 필요 없어 api 프로세스도 가져와요. engine의 FundService도 같은 계산을 써요
@Injectable()
export class FundQueryService {
  constructor(
    private readonly allocations: AllocationRepository,
    private readonly positions: PositionService,
    private readonly orders: OrderQueryService,
  ) {}

  // 배분마다 확정 이후 실현 손익, 보유 매수 금액, 미체결 매수 금액을 모아요 (POL-FUND-02)
  async fundsOf(allocations: Allocation[]): Promise<Map<number, RunningFunds>> {
    const botIds = allocations.map(({ botId }) => botId);
    const [holdings, openOrders] = await Promise.all([
      this.positions.botHoldings(
        allocations.map(({ botId, createdAt }) => ({
          botId,
          since: createdAt,
        })),
      ),
      this.orders.openOrdersByBot(botIds),
    ]);
    return new Map(
      allocations.map(({ botId, amount }) => {
        const held = holdings.get(botId);
        const open = openOrders.get(botId);
        return [
          botId,
          {
            amount,
            realizedPnl: held?.realizedPnl ?? 0,
            holdingsCost: held?.holdingsCost ?? 0,
            openBuyAmount: open?.openBuyAmount ?? 0,
            hasHoldings: held?.hasHoldings ?? false,
            hasOpenOrders: open?.hasOpenOrders ?? false,
          },
        ];
      }),
    );
  }

  // 화면용: 확정된 봇만 자금 정보를 줘요. 확정 전이면 Map에 없어요
  async viewsOf(botIds: number[]): Promise<Map<number, BotFundsView>> {
    if (botIds.length === 0) return new Map();
    const allocations = await this.allocations.findActiveByBots(botIds);
    const funds = await this.fundsOf(allocations);
    return new Map(
      allocations.flatMap((allocation) => {
        const own = funds.get(allocation.botId);
        if (!own) return [];
        const usedAmount = own.holdingsCost + own.openBuyAmount;
        return [
          [
            allocation.botId,
            {
              ...own,
              allocatedAt: allocation.createdAt,
              capitalAtAllocation: allocation.snapshot.availableCapital,
              usedAmount,
              remainingBudget: own.amount - usedAmount,
              cashShare: cashShare(own),
            },
          ],
        ];
      }),
    );
  }

  // 누적 손실 한도까지 남은 여유(원). 손익이 음수면 그만큼 줄어요 (POL-RISK-01, 03)
  lossRoom(amount: number, totalLossPct: number, totalPnl: number): number {
    return lossLimit(amount, totalLossPct) + totalPnl;
  }
}
