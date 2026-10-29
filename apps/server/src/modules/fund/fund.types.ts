import type { WaitingReason } from './fund.constants.js';

// 같은 시각에 시작하는 봇 하나의 투자금 설정
export interface BotBudget {
  botId: number;
  // 정률(0~1) 또는 정액(원)
  budget: { type: 'ratio'; ratio: number } | { type: 'fixed'; amount: number };
  // 정액 확정 순서. 작을수록 먼저 (POL-FUND-14)
  startPriority: number;
  // 검증 구간이면 상한까지만 확정 (POL-FUND-11)
  isVerifying: boolean;
  // 1회 주문 금액이 정액이면 그 금액. 정률이면 null (POL-FUND-16)
  fixedOrderSize: number | null;
}

export type AllocationOutcome =
  | { botId: number; status: 'allocated'; amount: number; capped: boolean }
  | { botId: number; status: 'waiting'; reason: WaitingReason };

export interface AllocationPlan {
  // 봇 순서는 입력 순서 그대로예요
  outcomes: AllocationOutcome[];
  // 확정하고 남은 미배분 금액
  unallocated: number;
}

// 봇 하나의 지금 돈 상태 (POL-FUND-02, 05)
export interface BotFunds {
  // 확정 투자금
  amount: number;
  // 수수료·세금 차감 후 실현 손익
  realizedPnl: number;
  // 보유 종목 매수 금액
  holdingsCost: number;
  // 미체결 매수 주문 금액
  openBuyAmount: number;
}
