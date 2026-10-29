import {
  availableCapital,
  canBuy,
  canRebudget,
  cashShare,
  isRatioSumValid,
  planAllocation,
  releaseAmount,
} from './allocation.rule.js';
import type { BotBudget, BotFunds } from './fund.types.js';

// docs/policy/fund-allocation.md의 실전 예시와 검증 시나리오를 그대로 옮겼어요. 수수료·세금은 0으로 봐요.
const ratio = (
  botId: number,
  value: number,
  fields: Partial<BotBudget> = {},
): BotBudget => ({
  botId,
  budget: { type: 'ratio', ratio: value },
  startPriority: botId,
  isVerifying: false,
  fixedOrderSize: null,
  ...fields,
});
const fixed = (
  botId: number,
  amount: number,
  fields: Partial<BotBudget> = {},
): BotBudget => ({
  botId,
  budget: { type: 'fixed', amount },
  startPriority: botId,
  isVerifying: false,
  fixedOrderSize: null,
  ...fields,
});
const funds = (fields: Partial<BotFunds> = {}): BotFunds => ({
  amount: 0,
  realizedPnl: 0,
  holdingsCost: 0,
  openBuyAmount: 0,
  ...fields,
});
const allocated = (botId: number, amount: number, capped = false) => ({
  botId,
  status: 'allocated',
  amount,
  capped,
});
const waiting = (botId: number, reason: string) => ({
  botId,
  status: 'waiting',
  reason,
});

describe('자금 배분 규칙', () => {
  describe('실전 예시', () => {
    it('예시 1: 정률 봇만 시작하면 운용 자산 비율대로 확정되고 나머지는 미배분이에요', () => {
      const plan = planAllocation(1_000_000, [
        ratio(1, 0.1),
        ratio(2, 0.2),
        ratio(3, 0.3),
      ]);

      expect(plan).toEqual({
        outcomes: [
          allocated(1, 100_000),
          allocated(2, 200_000),
          allocated(3, 300_000),
        ],
        unallocated: 400_000,
      });
    });

    it('예시 2: 정률을 먼저 확정하고 남은 금액에서 정액을 우선순위 순으로 확정해요', () => {
      const plan = planAllocation(1_000_000, [
        ratio(1, 0.2),
        ratio(2, 0.3),
        fixed(3, 150_000, { startPriority: 1 }),
        fixed(4, 100_000, { startPriority: 2 }),
      ]);

      expect(plan.outcomes).toEqual([
        allocated(1, 200_000),
        allocated(2, 300_000),
        allocated(3, 150_000),
        allocated(4, 100_000),
      ]);
      expect(plan.unallocated).toBe(250_000);
    });

    it('예시 2: 검증 구간 정액 봇은 상한 10만 원으로 확정되고 그만큼 미배분이 늘어요', () => {
      const plan = planAllocation(1_000_000, [
        ratio(1, 0.2),
        ratio(2, 0.3),
        fixed(3, 150_000, { startPriority: 1, isVerifying: true }),
        fixed(4, 100_000, { startPriority: 2 }),
      ]);

      expect(plan.outcomes[2]).toEqual(allocated(3, 100_000, true));
      expect(plan.unallocated).toBe(300_000);
    });

    it('예시 3: 정액 2순위가 자금 부족으로 보류돼도 남은 금액 안의 3순위는 확정돼요', () => {
      const plan = planAllocation(500_000, [
        ratio(1, 0.4),
        ratio(2, 0.3),
        fixed(3, 100_000, { startPriority: 1 }),
        fixed(4, 80_000, { startPriority: 2 }),
        fixed(5, 30_000, { startPriority: 3 }),
      ]);

      expect(plan.outcomes).toEqual([
        allocated(1, 200_000),
        allocated(2, 150_000),
        allocated(3, 100_000),
        waiting(4, 'insufficient_funds'),
        allocated(5, 30_000),
      ]);
      expect(plan.unallocated).toBe(20_000);
    });

    it('예시 4: 정액 1만 원은 9천 원으로 줄여 시작하지 않고, 1회 주문 금액보다 작은 정률 봇도 보류해요', () => {
      const plan = planAllocation(9000, [
        fixed(6, 10_000),
        ratio(7, 0.5, { fixedOrderSize: 5000 }),
      ]);

      expect(plan.outcomes).toEqual([
        waiting(6, 'insufficient_funds'),
        waiting(7, 'below_order_size'),
      ]);
      expect(plan.unallocated).toBe(9000);
    });

    it('예시 5: 이월 봇과 실행 중인 봇의 현금 몫만 빼고 늦게 시작하는 봇을 확정해요', () => {
      // 2일차 08:59: S(30만, 25만어치 보유)
      const swing = funds({ amount: 300_000, holdingsCost: 250_000 });
      const morning = availableCapital(770_000, [swing]);
      expect(morning).toBe(720_000);
      const dayPlan = planAllocation(morning, [ratio(1, 0.5)]);
      expect(dayPlan.outcomes).toEqual([allocated(1, 360_000)]);

      // 15:10: A가 10만어치 매수 후 보유, 주문 가능 금액 67만
      const day = funds({ amount: 360_000, holdingsCost: 100_000 });
      const afternoon = availableCapital(670_000, [swing, day]);
      expect(afternoon).toBe(360_000);
      const closingPlan = planAllocation(afternoon, [fixed(2, 200_000)]);
      expect(closingPlan).toEqual({
        outcomes: [allocated(2, 200_000)],
        unallocated: 160_000,
      });
    });
  });

  describe('검증 시나리오', () => {
    it('1: 같은 시각 시작 봇 3개(10/20/30%)는 10만/20만/30만 원이에요', () => {
      const plan = planAllocation(1_000_000, [
        ratio(1, 0.1),
        ratio(2, 0.2),
        ratio(3, 0.3),
      ]);

      expect(
        plan.outcomes.map((outcome) =>
          outcome.status === 'allocated' ? outcome.amount : 0,
        ),
      ).toEqual([100_000, 200_000, 300_000]);
    });

    it('2: 정률 합이 110%면 거부되고, 100%까지는 통과해요', () => {
      expect(isRatioSumValid([0.5, 0.6])).toBe(false);
      expect(isRatioSumValid([0.1, 0.2, 0.3, 0.4])).toBe(true);
      // 소수 오차로 100%를 넘었다고 보지 않아요 (0.1 + 0.2 = 0.30000000000000004)
      expect(isRatioSumValid([0.1, 0.2, 0.7])).toBe(true);
    });

    it('3·8: 실현 수익은 그 봇의 한도에 더하지 않고, 다른 봇 투자금도 바꾸지 않아요', () => {
      const winner = funds({ amount: 100_000, realizedPnl: 20_000 });

      expect(canBuy(winner, 100_000, 0)).toBe(true);
      expect(canBuy(winner, 100_001, 0)).toBe(false);
      expect(releaseAmount(winner)).toBe(120_000);
    });

    it('4: 보유 8만 + 미체결 1.5만 + 신규 1만 + 수수료가 10만 원을 넘으면 주문을 막아요', () => {
      const bot = funds({
        amount: 100_000,
        holdingsCost: 80_000,
        openBuyAmount: 15_000,
      });

      expect(canBuy(bot, 10_000, 10)).toBe(false);
      expect(canBuy(bot, 5000, 0)).toBe(true);
    });

    it('5: 이월 봇(20만, 보유 5만)은 다음 날 현금 몫 15만 원만 빠져 20만 원 전체가 묶여요', () => {
      const carried = funds({ amount: 200_000, holdingsCost: 50_000 });

      expect(cashShare(carried)).toBe(150_000);
      expect(availableCapital(1_000_000, [carried])).toBe(850_000);
    });

    it('7: 늦게 시작하는 봇은 그 시각 운용 자산 기준으로 배분해요', () => {
      const morningBots = [funds({ amount: 600_000, holdingsCost: 600_000 })];
      // 09:00 봇들이 60만 원을 모두 주식으로 산 뒤 주문 가능 금액 40만
      const capital = availableCapital(400_000, morningBots);

      expect(planAllocation(capital, [ratio(9, 0.5)]).outcomes).toEqual([
        allocated(9, 200_000),
      ]);
    });

    it('9: 운용 자산은 주문 가능 금액과 봇 현금 몫으로만 계산해요', () => {
      expect(availableCapital(500_000, [])).toBe(500_000);
    });

    it('10: 상한 10만 원, 정률 30% 검증 구간 봇은 10만 원이고 합계 검사에는 30%로 들어가요', () => {
      const plan = planAllocation(1_000_000, [
        ratio(1, 0.3, { isVerifying: true }),
      ]);

      expect(plan.outcomes).toEqual([allocated(1, 100_000, true)]);
      expect(isRatioSumValid([0.3, 0.75])).toBe(false);
    });

    it('11: 검증 구간 봇이 3만 원 수익을 낸 뒤 다시 정하면 13만 원을 돌려주고 새로 확정해요', () => {
      const bot = funds({ amount: 100_000, realizedPnl: 30_000 });
      const returned = releaseAmount(bot);
      expect(returned).toBe(130_000);

      const plan = planAllocation(870_000 + returned, [ratio(1, 0.3)]);
      expect(plan.outcomes).toEqual([allocated(1, 300_000)]);
    });

    it('12: 정률 50%는 정액을 뺀 금액이 아니라 운용 자산 전체의 50%예요', () => {
      const plan = planAllocation(1_000_000, [
        fixed(1, 300_000),
        ratio(2, 0.5),
      ]);

      expect(plan.outcomes).toEqual([
        allocated(1, 300_000),
        allocated(2, 500_000),
      ]);
    });

    it('13: 정률 합이 100% 이하면 정률 봇은 항상 확정되고 보류는 정액에서만 생겨요', () => {
      const plan = planAllocation(100_000, [
        fixed(1, 1),
        ratio(2, 0.6),
        ratio(3, 0.4),
      ]);

      expect(plan.outcomes).toEqual([
        waiting(1, 'insufficient_funds'),
        allocated(2, 60_000),
        allocated(3, 40_000),
      ]);
    });

    it('14: 정액 1만 원 봇은 9천 원이 남으면 보류되고 9천 원으로 시작하지 않아요', () => {
      expect(planAllocation(9000, [fixed(1, 10_000)]).outcomes).toEqual([
        waiting(1, 'insufficient_funds'),
      ]);
    });

    it('15: 정액 2순위가 보류돼도 3순위가 남은 금액 안이면 확정돼요', () => {
      const plan = planAllocation(100_000, [
        fixed(1, 60_000),
        fixed(2, 50_000),
        fixed(3, 40_000),
      ]);

      expect(plan.outcomes).toEqual([
        allocated(1, 60_000),
        waiting(2, 'insufficient_funds'),
        allocated(3, 40_000),
      ]);
    });

    it('16: 1회 주문 금액이 정액 5천 원인데 확정 투자금이 4,500원이면 보류해요', () => {
      expect(
        planAllocation(9000, [ratio(1, 0.5, { fixedOrderSize: 5000 })])
          .outcomes,
      ).toEqual([waiting(1, 'below_order_size')]);
    });

    it('17: 실현 손실 3만 원은 주문 가능 금액과 그 봇 현금 몫을 함께 줄여 운용 자산은 그대로예요', () => {
      const before = availableCapital(1_000_000, [funds({ amount: 200_000 })]);
      const after = availableCapital(970_000, [
        funds({ amount: 200_000, realizedPnl: -30_000 }),
      ]);

      expect(after).toBe(before);
    });

    it('18: 보유 종목이나 미체결이 있거나 운영 시간 안이면 투자금을 다시 정할 수 없어요', () => {
      const idle = {
        hasHoldings: false,
        hasOpenOrders: false,
        isTradingHours: false,
      };

      expect(canRebudget(idle)).toEqual({ ok: true });
      expect(canRebudget({ ...idle, hasHoldings: true })).toEqual({
        ok: false,
        reason: 'holdings',
      });
      expect(canRebudget({ ...idle, hasOpenOrders: true })).toEqual({
        ok: false,
        reason: 'open_orders',
      });
      expect(canRebudget({ ...idle, isTradingHours: true })).toEqual({
        ok: false,
        reason: 'trading_hours',
      });
    });

    // 기존 투자금과 배분 행을 그대로 두는 일은 서비스가 해요
    it('19: 새 금액을 확정할 운용 자산이 모자라면 보류로 나와요', () => {
      expect(planAllocation(50_000, [fixed(1, 100_000)]).outcomes).toEqual([
        waiting(1, 'insufficient_funds'),
      ]);
    });

    it('20: 검증 구간 봇은 정액을 200만에서 50만으로 바꿔도 상한 10만 원으로 확정돼요', () => {
      const plan = planAllocation(5_000_000, [
        fixed(1, 500_000, { isVerifying: true }),
      ]);

      expect(plan.outcomes).toEqual([allocated(1, 100_000, true)]);
    });

    it('21: 상한이 풀린 봇이 300만에서 100만으로 줄이면 손익 포함해 돌려주고 100만으로 확정해요', () => {
      const returned = releaseAmount(
        funds({ amount: 3_000_000, realizedPnl: 120_000 }),
      );
      expect(returned).toBe(3_120_000);

      expect(planAllocation(3_120_000, [fixed(1, 1_000_000)]).outcomes).toEqual(
        [allocated(1, 1_000_000)],
      );
    });
  });

  // 투자금은 0보다 커야 해요 (allocations CHECK amount > 0)
  it('운용 자산이 0이면 정률 봇도 확정하지 않아요', () => {
    expect(planAllocation(0, [ratio(1, 0.5)]).outcomes).toEqual([
      waiting(1, 'insufficient_funds'),
    ]);
  });

  it('정률은 원 단위로 내림해요', () => {
    expect(planAllocation(333_333, [ratio(1, 0.3333)]).outcomes).toEqual([
      allocated(1, 111_099),
    ]);
  });
});
