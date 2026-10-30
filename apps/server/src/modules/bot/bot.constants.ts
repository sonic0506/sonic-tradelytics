import { z } from 'zod';

// 값 목록은 docs/architecture/data-model.md의 CHECK와 같아요.
export const BOT_TYPES = ['scalping', 'day', 'swing', 'closing'] as const;
export type BotType = (typeof BOT_TYPES)[number];

export const RISK_PROFILES = ['aggressive', 'neutral', 'conservative'] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

// 검증 구간 (POL-RISK-13)
export const BOT_STAGES = ['verifying', 'released'] as const;
export type BotStage = (typeof BOT_STAGES)[number];

export const BOT_STATUSES = [
  'ready',
  'running',
  'paused',
  'waiting_funds',
  'stopped',
] as const;
export type BotStatus = (typeof BOT_STATUSES)[number];

// 투자금·1회 주문 금액 방식: 정률·정액
export const AMOUNT_TYPES = ['ratio', 'fixed'] as const;
export type AmountType = (typeof AMOUNT_TYPES)[number];

// 운용 기간 종료(FR-BOT-08)·하루 한도 도달(POL-RISK-02) 시 보유분 처리
export const HOLDING_ACTIONS = ['liquidate', 'hold'] as const;
export type HoldingAction = (typeof HOLDING_ACTIONS)[number];

// decision_change면 검증 구간을 다시 시작해요 (FR-BOT-11)
export const VERSION_CHANGE_KINDS = [
  'initial',
  'decision_change',
  'risk_only',
] as const;
export type VersionChangeKind = (typeof VERSION_CHANGE_KINDS)[number];

// 데이 트레이딩 기본 규칙 값 (중립 성향, 2026-10-30 확정). F1 3단계에서 숫자만 바꿔요
export const DAY_TRADING_DEFAULTS = {
  maxRank: 30,
  minPrice: 1_000,
  maxPrice: 200_000,
  minRisePct: 2,
  maxRisePct: 10,
  vwapBandPct: 1,
  takeProfit1Pct: 2,
  takeProfit2Pct: 4,
  vwapExitPct: 0.5,
  stopLossPct: 2,
  exitAt: '15:15:00',
  reentryCooldownMinutes: 30,
};

// 지금 전략(규칙 함수)이 있는 유형. 나머지 유형은 만들 수 없어요 (M6·M7)
export const SUPPORTED_BOT_TYPES = [
  'day',
] as const satisfies readonly BotType[];

// 데이 트레이딩 규칙 값 모양 (FR-RAT-07). 모르는 키는 거부하고, 빠진 키는 기본값으로 채워요
export const dayTradingParamsSchema = z
  .object({
    maxRank: z.number().int().positive(),
    minPrice: z.number().positive(),
    maxPrice: z.number().positive(),
    minRisePct: z.number(),
    maxRisePct: z.number(),
    vwapBandPct: z.number().nonnegative(),
    takeProfit1Pct: z.number().positive(),
    takeProfit2Pct: z.number().positive(),
    vwapExitPct: z.number().positive(),
    stopLossPct: z.number().positive(),
    exitAt: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
    reentryCooldownMinutes: z.number().int().nonnegative(),
  })
  .strict()
  .partial();

// 화면(F1 3단계)에 보여 줄 규칙 값 칸. 이름·단위·묶음은 서버가 정해요
export interface RuleFieldMeta {
  key: keyof typeof DAY_TRADING_DEFAULTS;
  group: 'filter' | 'entry' | 'exit';
  label: string;
  kind: 'number' | 'time';
  unit: string | null;
}

export const DAY_TRADING_FIELDS: RuleFieldMeta[] = [
  {
    key: 'maxRank',
    group: 'filter',
    label: '거래대금 순위',
    kind: 'number',
    unit: '위',
  },
  {
    key: 'minPrice',
    group: 'filter',
    label: '주가 하한',
    kind: 'number',
    unit: '원',
  },
  {
    key: 'maxPrice',
    group: 'filter',
    label: '주가 상한',
    kind: 'number',
    unit: '원',
  },
  {
    key: 'minRisePct',
    group: 'filter',
    label: '시가 대비 상승률 하한',
    kind: 'number',
    unit: '%',
  },
  {
    key: 'maxRisePct',
    group: 'filter',
    label: '시가 대비 상승률 상한',
    kind: 'number',
    unit: '%',
  },
  {
    key: 'vwapBandPct',
    group: 'entry',
    label: 'VWAP 위 허용 폭',
    kind: 'number',
    unit: '%',
  },
  {
    key: 'reentryCooldownMinutes',
    group: 'entry',
    label: '재진입 대기',
    kind: 'number',
    unit: '분',
  },
  {
    key: 'takeProfit1Pct',
    group: 'exit',
    label: '1차 익절(절반)',
    kind: 'number',
    unit: '%',
  },
  {
    key: 'takeProfit2Pct',
    group: 'exit',
    label: '2차 익절(나머지)',
    kind: 'number',
    unit: '%',
  },
  {
    key: 'vwapExitPct',
    group: 'exit',
    label: 'VWAP 이탈 청산',
    kind: 'number',
    unit: '%',
  },
  {
    key: 'stopLossPct',
    group: 'exit',
    label: '손절',
    kind: 'number',
    unit: '%',
  },
  {
    key: 'exitAt',
    group: 'exit',
    label: '장 마감 전 청산',
    kind: 'time',
    unit: null,
  },
];

// 봇 만들기 2·4단계 기본값 (데이 트레이딩, 검증 구간 상한 10만 원 안에서 시작)
export const DAY_TRADING_SETUP = {
  budget: { type: 'fixed', value: 100_000 },
  orderAmount: 50_000,
  splitCount: 1,
  maxPositions: 2,
  tradingHours: { start: '09:05', end: '15:20' },
  stopStreak: 3,
  onDailyLimit: 'liquidate',
} as const;
