import {
  FEE_RESERVE_RATE,
  RATIO_SCALE,
  VERIFICATION_CAP,
} from './fund.constants.js';
import type {
  AllocationOutcome,
  AllocationPlan,
  BotBudget,
  BotFunds,
} from './fund.types.js';

// 자금 배분 규칙 (docs/policy/fund-allocation.md). 금액은 원 단위 정수예요.

// 비율을 정수(0~10000)로 바꿔 소수 오차 없이 더하고 곱해요
const scaled = (ratio: number): number => Math.round(ratio * RATIO_SCALE);

// POL-FUND-03: 같은 시각에 시작하는 봇들의 정률 합은 100% 이하. 검증 구간 봇도 설정 비율 그대로 넣어요 (POL-FUND-11)
export function isRatioSumValid(ratios: number[]): boolean {
  return ratios.reduce((sum, ratio) => sum + scaled(ratio), 0) <= RATIO_SCALE;
}

// POL-FUND-13~16, 11: 같은 스냅샷의 운용 자산으로 같은 시각에 시작하는 봇들의 투자금을 정해요.
// 정률 합 검사(isRatioSumValid)를 통과한 봇들만 넘겨요.
export function planAllocation(
  capital: number,
  bots: BotBudget[],
  cap: number = VERIFICATION_CAP,
): AllocationPlan {
  const outcomes: AllocationOutcome[] = [];
  let remaining = capital;
  const confirm = (bot: BotBudget, desired: number): AllocationOutcome => {
    const amount = bot.isVerifying ? Math.min(desired, cap) : desired;
    // 한 번도 주문할 수 없는 봇은 시작하지 않아요 (POL-FUND-16)
    if (bot.fixedOrderSize !== null && amount < bot.fixedOrderSize)
      return {
        botId: bot.botId,
        status: 'waiting',
        reason: 'below_order_size',
      };
    // 정액은 줄여서 시작하지 않아요 (POL-FUND-15)
    if (amount <= 0 || amount > remaining)
      return {
        botId: bot.botId,
        status: 'waiting',
        reason: 'insufficient_funds',
      };
    remaining -= amount;
    return {
      botId: bot.botId,
      status: 'allocated',
      amount,
      capped: amount < desired,
    };
  };

  // ① 정률: 운용 자산 전체 기준, 원 단위 내림 (POL-FUND-13)
  bots.forEach((bot, index) => {
    if (bot.budget.type === 'ratio')
      outcomes[index] = confirm(
        bot,
        Math.floor((capital * scaled(bot.budget.ratio)) / RATIO_SCALE),
      );
  });
  // ② 정액: 남은 금액에서 시작 우선순위 순. 보류돼도 다음 순서를 계속 봐요 (POL-FUND-14, 15)
  bots
    .map((bot, index) => ({ bot, index }))
    .filter(({ bot }) => bot.budget.type === 'fixed')
    .sort(
      (left, right) =>
        left.bot.startPriority - right.bot.startPriority ||
        left.index - right.index,
    )
    .forEach(({ bot, index }) => {
      if (bot.budget.type === 'fixed')
        outcomes[index] = confirm(bot, bot.budget.amount);
    });

  return { outcomes, unallocated: remaining };
}

// 봇에 묶여 있지만 아직 현금인 돈 (POL-FUND-02). 산 주식과 미체결 매수는 이미 주문 가능 금액에서 빠져 있어요
export function cashShare(funds: BotFunds): number {
  return (
    funds.amount + funds.realizedPnl - funds.holdingsCost - funds.openBuyAmount
  );
}

// POL-FUND-02, 07: 운용 자산 = 주문 가능 금액 − 실행 중인 봇들의 현금 몫
export function availableCapital(
  orderableCash: number,
  runningBots: BotFunds[],
): number {
  return runningBots.reduce(
    (capital, funds) => capital - cashShare(funds),
    orderableCash,
  );
}

// POL-FUND-05, 10: 매수 주문 전 한도 검사. 실현 수익은 한도에 더하지 않아요
export function canBuy(
  funds: BotFunds,
  orderAmount: number,
  estimatedFee: number,
): boolean {
  return (
    funds.holdingsCost + funds.openBuyAmount + orderAmount + estimatedFee <=
    funds.amount
  );
}

// POL-FUND-05, 16: 진입 1회에 쓸 금액. 1회 주문 금액과 남은 한도 중 작은 쪽에서 수수료 예비를 빼요
export function entryAmount(funds: BotFunds, orderSize: number): number {
  const room = funds.amount - funds.holdingsCost - funds.openBuyAmount;
  return Math.max(
    Math.floor(Math.min(orderSize, room) / (1 + FEE_RESERVE_RATE)),
    0,
  );
}

// POL-FUND-06, 10: 봇이 종료·중지될 때 운용 자산으로 돌려줄 금액(손익 포함). 보유·미체결이 없을 때 불러요
export function releaseAmount(funds: BotFunds): number {
  return cashShare(funds);
}

// POL-FUND-12: 투자금 다시 정하기는 쉬는 중(보유·미체결 없음, 운영 시간 밖)에만
export function canRebudget(state: {
  hasHoldings: boolean;
  hasOpenOrders: boolean;
  isTradingHours: boolean;
}):
  | { ok: true }
  | { ok: false; reason: 'holdings' | 'open_orders' | 'trading_hours' } {
  if (state.hasHoldings) return { ok: false, reason: 'holdings' };
  if (state.hasOpenOrders) return { ok: false, reason: 'open_orders' };
  if (state.isTradingHours) return { ok: false, reason: 'trading_hours' };
  return { ok: true };
}
