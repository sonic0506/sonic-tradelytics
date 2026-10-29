import {
  ACCOUNT_ORDERS_PER_DAY,
  BOT_ORDERS_PER_MINUTE,
} from './risk.constants.js';

// 손실·주문 한도 규칙 (docs/policy/risk-management.md). 손실 %는 양수로 받아요(4 → -4%).

const PERCENT = 100;

// 투자금 대비 손실 한도 금액(원). 손실이 이 금액 이상이면 한도에 닿아요
export function lossLimit(amount: number, lossPct: number): number {
  return Math.floor((amount * lossPct) / PERCENT);
}

// 손익(실현 + 보유분 평가, 수수료·세금 차감 후)이 한도 금액만큼 잃었는지
export function isLossHit(
  pnl: number,
  amount: number,
  lossPct: number,
): boolean {
  return pnl <= -lossLimit(amount, lossPct);
}

// POL-RISK-02, 03: 누적 한도가 먼저예요(봇 종료가 하루 정지보다 무거워요). 기준 금액은 확정 투자금이에요
export function checkLossLimits(state: {
  amount: number;
  dailyPnl: number;
  totalPnl: number;
  dailyLossPct: number;
  totalLossPct: number;
}): 'ok' | 'daily_stop' | 'total_stop' {
  if (isLossHit(state.totalPnl, state.amount, state.totalLossPct))
    return 'total_stop';
  if (isLossHit(state.dailyPnl, state.amount, state.dailyLossPct))
    return 'daily_stop';
  return 'ok';
}

// POL-RISK-01 스윙(종목당)·종가 베팅(진입 1회당): 포지션 매수 금액 대비 손실
export function isPositionLossHit(
  costBasis: number,
  pnl: number,
  lossPct: number,
): boolean {
  return costBasis > 0 && isLossHit(pnl, costBasis, lossPct);
}

// POL-RISK-04: 가장 최근에 닫힌 포지션부터 N개가 모두 손절이면 일시 정지해요. 최근이 앞이에요
export function isStopStreakHit(
  recentExitReasons: (string | null)[],
  stopStreak: number,
): boolean {
  return (
    recentExitReasons.length >= stopStreak &&
    recentExitReasons
      .slice(0, stopStreak)
      .every((reason) => reason === 'stop_loss')
  );
}

// POL-RISK-08: 이번 주문을 내면 상한을 넘는지. 넘으면 주문하지 않고 봇을 일시 정지해요
export function checkOrderRate(
  counts: { botOrdersLastMinute: number; accountOrdersToday: number },
  caps: { perBotPerMinute: number; accountPerDay: number } = {
    perBotPerMinute: BOT_ORDERS_PER_MINUTE,
    accountPerDay: ACCOUNT_ORDERS_PER_DAY,
  },
): 'ok' | 'bot_rate' | 'account_daily' {
  if (counts.accountOrdersToday >= caps.accountPerDay) return 'account_daily';
  if (counts.botOrdersLastMinute >= caps.perBotPerMinute) return 'bot_rate';
  return 'ok';
}
