import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { z } from 'zod';

import { kstTime } from '@/common/time/kst-date.js';
import { AccountSnapshotService } from '@/modules/account/index.js';
import { BotService, type BotWithVersion } from '@/modules/bot/index.js';
import { OrderService } from '@/modules/order/index.js';
import { PositionService } from '@/modules/position/index.js';
import { RiskService } from '@/modules/risk/index.js';

import { AllocationRepository } from './allocation.repository.js';
import {
  canRebudget,
  cashShare,
  entryAmount,
  isRatioSumValid,
  planAllocation,
  releaseAmount,
} from './allocation.rule.js';
import type { Allocation } from './entities/allocation.entity.js';
import { FundRatioExceededException } from './fund.exception.js';
import type { AllocationOutcome, BotBudget, BotFunds } from './fund.types.js';

// rebudget 명령의 새 투자금 설정 (commands.budget)
const budgetSchema = z.intersection(
  z.discriminatedUnion('budgetType', [
    z.object({
      budgetType: z.literal('ratio'),
      budgetRatio: z.number().gt(0).lte(1),
    }),
    z.object({
      budgetType: z.literal('fixed'),
      budgetAmount: z.number().int().positive(),
    }),
  ]),
  z.object({
    orderSizeType: z.enum(['ratio', 'fixed']).optional(),
    orderSizeValue: z.number().positive().optional(),
  }),
);

// 봇 하나의 지금 돈 상태와 쉬는 중 판단에 쓰는 값
type RunningFunds = BotFunds & { hasHoldings: boolean; hasOpenOrders: boolean };

// commands.error에 남는 rebudget 실패 코드 (docs/architecture/api.md 에러 코드)
export type RebudgetResult = { ok: true } | { ok: false; error: string };

const NOT_RESTING_REASON = {
  holdings: 'holding',
  open_orders: 'pending_order',
  trading_hours: 'trading_hours',
} as const;

// 봇 투자금 확정·반환·다시 정하기 (docs/policy/fund-allocation.md). 계산은 allocation.rule.ts가 해요.
@Injectable()
export class FundService {
  constructor(
    private readonly allocations: AllocationRepository,
    private readonly snapshots: AccountSnapshotService,
    private readonly bots: BotService,
    private readonly positions: PositionService,
    private readonly orders: OrderService,
    private readonly risk: RiskService,
  ) {}

  // POL-FUND-01, 13~16: 같은 시각에 시작하는 봇들을 한 스냅샷으로 확정해요. 이미 배분이 있는 봇은 건너뛰어요.
  // 토스 호출(스냅샷)은 트랜잭션 밖에서 하고, 배분과 상태는 한 트랜잭션으로 남겨요.
  async allocate(botIds: number[]): Promise<AllocationOutcome[]> {
    const active = await this.allocations.findActive();
    const allocated = new Set(active.map(({ botId }) => botId));
    const targets = await this.bots.findWithVersions(
      botIds.filter((botId) => !allocated.has(botId)),
    );
    if (targets.length === 0) return [];
    const budgets = targets.map(toBudget);
    const ratios = budgets.flatMap(({ budget }) =>
      budget.type === 'ratio' ? [budget.ratio] : [],
    );
    if (!isRatioSumValid(ratios)) throw new FundRatioExceededException();

    const running = await this.fundsOf(active);
    const snapshot = await this.snapshots.take(totalCashShare(running));
    const plan = planAllocation(snapshot.availableCapital, budgets);
    await this.saveAllocation(snapshot.id, plan.outcomes, targets);
    return plan.outcomes;
  }

  // POL-FUND-06: 보유·미체결이 없으면 남은 금액(손익 포함)을 반환해요. 아직 반환할 수 없으면 null
  async release(botId: number): Promise<number | null> {
    const allocation = await this.allocations.findActiveByBot(botId);
    if (!allocation) return null;
    const funds = (await this.fundsOf([allocation])).get(botId);
    if (!funds || funds.hasHoldings || funds.hasOpenOrders) return null;
    const amount = releaseAmount(funds);
    await this.allocations.release(allocation.id, amount, new Date());
    return amount;
  }

  // 지금 확정 투자금과 확정 시각 (손실 한도 기준, POL-RISK-01). 없으면 null
  async activeAllocation(
    botId: number,
  ): Promise<{ amount: number; since: Date } | null> {
    const allocation = await this.allocations.findActiveByBot(botId);
    return allocation
      ? { amount: allocation.amount, since: allocation.createdAt }
      : null;
  }

  // 진입 1회에 쓸 금액 (POL-FUND-05, 16). 확정 투자금이 없으면 0이에요
  async entryBudget(
    botId: number,
    orderSize: { type: 'ratio' | 'fixed'; value: number },
  ): Promise<number> {
    const allocation = await this.allocations.findActiveByBot(botId);
    if (!allocation) return 0;
    const funds = (await this.fundsOf([allocation])).get(botId);
    if (!funds) return 0;
    const size =
      orderSize.type === 'ratio'
        ? Math.floor(funds.amount * orderSize.value)
        : orderSize.value;
    return entryAmount(funds, size);
  }

  // POL-FUND-12: 쉬는 중이면 지금 투자금을 반환하고 새 설정으로 다시 확정해요. 모자라면 기존 투자금을 그대로 둬요
  async rebudget(botId: number, raw: unknown): Promise<RebudgetResult> {
    const parsed = budgetSchema.safeParse(raw);
    if (!parsed.success) return failure('INVALID_BUDGET');
    const [target] = await this.bots.findWithVersions([botId]);
    if (!target) return failure('BOT_NOT_FOUND');
    const { bot, version } = target;
    if (bot.status !== 'running' && bot.status !== 'paused')
      return failure('BOT_NOT_RUNNING');
    // ponytail: 1회 주문 금액은 봇 버전 값이라 바꾸려면 새 버전이 필요해요. 봇 설정 API(M4)를 만들 때 붙여요
    const budget = parsed.data;
    if (
      (budget.orderSizeType !== undefined &&
        budget.orderSizeType !== version?.orderSizeType) ||
      (budget.orderSizeValue !== undefined &&
        budget.orderSizeValue !== version?.orderSizeValue)
    )
      return failure('ORDER_SIZE_CHANGE_UNSUPPORTED');

    const current = await this.allocations.findActiveByBot(botId);
    if (!current) return failure('NO_ALLOCATION');
    const active = await this.allocations.findActive();
    const funds = await this.fundsOf(active);
    const own = funds.get(botId);
    if (!own) return failure('NO_ALLOCATION');
    const resting = canRebudget({
      hasHoldings: own.hasHoldings,
      hasOpenOrders: own.hasOpenOrders,
      isTradingHours: isWithinTradingHours(bot.tradingStart, bot.tradingEnd),
    });
    if (!resting.ok)
      return failure(`BOT_NOT_RESTING:${NOT_RESTING_REASON[resting.reason]}`);

    // 이 봇의 현금은 주문 가능 금액에 들어 있어서, 다른 봇들의 현금 몫만 빼면 반환 뒤 운용 자산이에요
    funds.delete(botId);
    const snapshot = await this.snapshots.take(totalCashShare(funds));
    const fields = {
      budgetType: budget.budgetType,
      budgetRatio: budget.budgetType === 'ratio' ? budget.budgetRatio : null,
      budgetAmount: budget.budgetType === 'fixed' ? budget.budgetAmount : null,
    };
    const [outcome] = planAllocation(snapshot.availableCapital, [
      toBudget({ bot: { ...bot, ...fields }, version }),
    ]).outcomes;
    if (outcome?.status !== 'allocated') return failure('BUDGET_INSUFFICIENT');

    await this.saveRebudget(
      current.id,
      releaseAmount(own),
      {
        botId,
        snapshotId: snapshot.id,
        amount: outcome.amount,
        capped: outcome.capped,
      },
      fields,
    );
    return { ok: true };
  }

  @Transactional()
  private async saveAllocation(
    snapshotId: number,
    outcomes: AllocationOutcome[],
    targets: BotWithVersion[],
  ): Promise<void> {
    await this.allocations.add(
      outcomes.flatMap((outcome) =>
        outcome.status === 'allocated'
          ? [
              {
                botId: outcome.botId,
                snapshotId,
                amount: outcome.amount,
                capped: outcome.capped,
              },
            ]
          : [],
      ),
    );
    const bots = new Map(targets.map(({ bot }) => [bot.id, bot]));
    await outcomes.reduce<Promise<void>>(
      (previous, outcome) =>
        previous.then(async () => {
          const bot = bots.get(outcome.botId);
          if (!bot) return;
          if (outcome.status === 'allocated') {
            // 새 봇·자금 대기 봇은 확정되면 돌기 시작해요 (POL-FUND-09, 15)
            if (bot.status === 'ready' || bot.status === 'waiting_funds')
              await this.bots.setStatus(bot.id, 'running', null);
            return;
          }
          // 처음 보류될 때만 알려요 (POL-FUND-15)
          if (
            bot.status === 'waiting_funds' &&
            bot.statusReason === outcome.reason
          )
            return;
          await this.bots.setStatus(bot.id, 'waiting_funds', outcome.reason);
          await this.risk.record('funds_waiting', bot.id, {
            reason: outcome.reason,
          });
        }),
      Promise.resolve(),
    );
  }

  // 기존 배분 반환, 새 배분, 봇 설정을 함께 바꿔요. 하나라도 실패하면 셋 다 그대로예요
  @Transactional()
  private async saveRebudget(
    allocationId: number,
    releasedAmount: number,
    next: Pick<Allocation, 'botId' | 'snapshotId' | 'amount' | 'capped'>,
    fields: Parameters<BotService['updateBudget']>[1],
  ): Promise<void> {
    await this.allocations.release(allocationId, releasedAmount, new Date());
    await this.allocations.add([next]);
    await this.bots.updateBudget(next.botId, fields);
  }

  // 배분마다 확정 이후 실현 손익, 보유 매수 금액, 미체결 매수 금액을 모아요 (POL-FUND-02)
  private async fundsOf(
    allocations: Allocation[],
  ): Promise<Map<number, RunningFunds>> {
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
}

function failure(error: string): RebudgetResult {
  return { ok: false, error };
}

function totalCashShare(funds: Map<number, BotFunds>): number {
  return [...funds.values()].reduce((sum, bot) => sum + cashShare(bot), 0);
}

// ponytail: 봇 운영 시간만 봐요. 휴장일에도 운영 시간 안이면 쉬는 중이 아니라고 봐서 보수적이에요
function isWithinTradingHours(start: string, end: string): boolean {
  const now = kstTime();
  return start <= now && now < end;
}

function toBudget({ bot, version }: BotWithVersion): BotBudget {
  return {
    botId: bot.id,
    budget:
      bot.budgetType === 'ratio'
        ? { type: 'ratio', ratio: bot.budgetRatio ?? 0 }
        : { type: 'fixed', amount: bot.budgetAmount ?? 0 },
    startPriority: bot.startPriority,
    isVerifying: bot.stage === 'verifying',
    fixedOrderSize:
      version?.orderSizeType === 'fixed' ? version.orderSizeValue : null,
  };
}
