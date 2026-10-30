import { floorToTick } from '@/common/market/tick-size.js';

// 데이 트레이딩 규칙 (F1 유형별 규칙: 거래대금 급증·시가 대비 상승률 → VWAP 지지 → 분할 익절·VWAP 이탈·장 마감 전 청산).
// 실전·개발 점검·백테스트가 같은 함수를 써요 (ADR-0005)

const PERCENT = 100;
const MINUTES_PER_HOUR = 60;
const RATE_DIGITS = 2;

// bot_versions.params. 숫자는 사용자가 바꿀 수 있어요 (F1 3단계)
export interface DayTradingParams {
  // 거래대금 실시간 순위가 이 안이어야 해요
  maxRank: number;
  minPrice: number;
  maxPrice: number;
  // 시가 대비 상승률 범위(%)
  minRisePct: number;
  maxRisePct: number;
  // 현재가가 VWAP 위 0~이 값(%) 안이면 VWAP 지지로 봐요
  vwapBandPct: number;
  // 분할 익절 단계(%). 단계마다 남은 수량을 남은 단계 수로 나눠 팔아요
  takeProfitPcts: number[];
  // 현재가가 VWAP 아래로 이 값(%) 이상 내려가면 전량 청산
  vwapExitPct: number;
  // 손절 조건주문 발동가 = 진입가에서 이 값(%) 아래 (POL-RISK-11)
  stopLossPct: number;
  // 이 시각(KST HH:mm:ss)부터 전량 청산하고 신규 진입하지 않아요
  exitAt: string;
}

// 종목 하나의 판단 재료
export interface DayTradingMarket {
  price: number;
  // 오늘 정규장 시가
  openPrice: number;
  // 오늘 정규장 VWAP
  vwap: number;
  // 거래대금 실시간 순위 (1부터)
  rank: number;
}

// 충족·탈락한 조건 하나 (decision의 RuleResult와 같은 모양)
export interface RuleCheck {
  rule: string;
  value: number;
  threshold: number;
}

export interface EntryEvaluation {
  isEntry: boolean;
  passed: RuleCheck[];
  failed: RuleCheck[];
  // 충족한 조건 비율 0~100
  score: number;
}

const round = (value: number): number => Number(value.toFixed(RATE_DIGITS));
const pctChange = (from: number, to: number): number =>
  ((to - from) / from) * PERCENT;

// 진입 조건: 모두 충족해야 진입해요
export function evaluateEntry(
  params: DayTradingParams,
  market: DayTradingMarket,
): EntryEvaluation {
  const rise = round(pctChange(market.openPrice, market.price));
  const aboveVwap = round(pctChange(market.vwap, market.price));
  const checks: { check: RuleCheck; isMet: boolean }[] = [
    {
      check: {
        rule: 'trading_amount_rank',
        value: market.rank,
        threshold: params.maxRank,
      },
      isMet: market.rank <= params.maxRank,
    },
    {
      check: {
        rule: 'price_min',
        value: market.price,
        threshold: params.minPrice,
      },
      isMet: market.price >= params.minPrice,
    },
    {
      check: {
        rule: 'price_max',
        value: market.price,
        threshold: params.maxPrice,
      },
      isMet: market.price <= params.maxPrice,
    },
    {
      check: {
        rule: 'rise_from_open_min',
        value: rise,
        threshold: params.minRisePct,
      },
      isMet: rise >= params.minRisePct,
    },
    {
      check: {
        rule: 'rise_from_open_max',
        value: rise,
        threshold: params.maxRisePct,
      },
      isMet: rise <= params.maxRisePct,
    },
    {
      check: { rule: 'vwap_above', value: aboveVwap, threshold: 0 },
      isMet: aboveVwap >= 0,
    },
    {
      check: {
        rule: 'vwap_band',
        value: aboveVwap,
        threshold: params.vwapBandPct,
      },
      isMet: aboveVwap <= params.vwapBandPct,
    },
  ];
  const passed = checks.filter(({ isMet }) => isMet).map(({ check }) => check);
  const failed = checks.filter(({ isMet }) => !isMet).map(({ check }) => check);
  return {
    isEntry: failed.length === 0,
    passed,
    failed,
    score: Math.round((passed.length / checks.length) * PERCENT),
  };
}

// 진입 예측: 마지막 익절 단계가 목표가, 손절 조건주문 발동가, 장 마감 전 청산까지의 분
export function entryPlan(
  params: DayTradingParams,
  price: number,
  nowKst: string,
): { targetPrice: number; stopPrice: number; horizonMinutes: number } {
  const lastTakeProfit = params.takeProfitPcts.at(-1) ?? 0;
  return {
    targetPrice: floorToTick(price * (1 + lastTakeProfit / PERCENT)),
    stopPrice: floorToTick(price * (1 - params.stopLossPct / PERCENT)),
    horizonMinutes: Math.max(minutesOf(params.exitAt) - minutesOf(nowKst), 0),
  };
}

function minutesOf(kstTime: string): number {
  const [hours = 0, minutes = 0] = kstTime.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

export type ExitSignal =
  | { action: 'hold' }
  | {
      action: 'sell';
      reason: 'time_exit' | 'vwap_break' | 'take_profit';
      // 지금 보유 수량 중 팔 비율 (0~1]
      ratio: number;
      check: RuleCheck;
    };

// 청산 판단. 장 마감 전 청산 → VWAP 이탈 → 분할 익절 순서로 봐요. 손절은 조건주문이 맡아요 (POL-RISK-11)
export function evaluateExit(
  params: DayTradingParams,
  state: {
    price: number;
    vwap: number;
    // 보유 평균 단가
    avgPrice: number;
    // 이미 실행한 익절 단계 수
    takenSteps: number;
    nowKst: string;
  },
): ExitSignal {
  if (state.nowKst >= params.exitAt)
    return {
      action: 'sell',
      reason: 'time_exit',
      ratio: 1,
      check: {
        rule: 'exit_at',
        value: minutesOf(state.nowKst),
        threshold: minutesOf(params.exitAt),
      },
    };
  const belowVwap = round(-pctChange(state.vwap, state.price));
  if (belowVwap >= params.vwapExitPct)
    return {
      action: 'sell',
      reason: 'vwap_break',
      ratio: 1,
      check: {
        rule: 'vwap_break',
        value: belowVwap,
        threshold: params.vwapExitPct,
      },
    };
  const step = params.takeProfitPcts[state.takenSteps];
  const profit = round(pctChange(state.avgPrice, state.price));
  if (step !== undefined && profit >= step)
    return {
      action: 'sell',
      reason: 'take_profit',
      ratio: 1 / (params.takeProfitPcts.length - state.takenSteps),
      check: {
        rule: `take_profit_${state.takenSteps + 1}`,
        value: profit,
        threshold: step,
      },
    };
  return { action: 'hold' };
}
