import type { GetAllocationPreview } from '@/entities/allocation';
import type {
  AmountType,
  BotDefaults,
  HoldingAction,
  RiskProfile,
  RuleField,
} from '@/entities/bot';
import type { BotType } from '@/shared/api';

// 정액 봇끼리 자금이 모자랄 때 먼저 확정할 순서 (FR-BOT-10)
export type StartPriority = 'last' | 'first';

// 입력란 값은 문자열로 들고 있다가 만들 때 숫자로 바꿔요.
// 투자금은 정률이면 %(예: "30"), 정액이면 원이에요. 손실 중지는 "-3"처럼 음수로도 받아요.
export type BotDraft = {
  name: string;
  type: BotType;
  riskProfile: RiskProfile;
  budgetType: AmountType;
  budgetValue: string;
  startPriority: StartPriority;
  orderAmount: string;
  splitCount: string;
  maxPositions: string;
  periodStart: string;
  periodEnd: string;
  isIndefinite: boolean;
  onPeriodEnd: HoldingAction;
  tradingStart: string;
  tradingEnd: string;
  rules: Record<string, string>;
  firstLossPct: string;
  totalLossPct: string;
  stopStreak: string;
  onDailyLimit: HoldingAction;
};

// 입력란 이름 → 고치는 방법. 규칙 값은 "rule.<key>"예요.
export type DraftErrors = Partial<Record<string, string>>;

export const INITIAL_DRAFT: BotDraft = {
  name: '',
  type: 'day',
  riskProfile: 'neutral',
  budgetType: 'ratio',
  budgetValue: '',
  startPriority: 'last',
  orderAmount: '',
  splitCount: '',
  maxPositions: '',
  periodStart: '',
  periodEnd: '',
  isIndefinite: true,
  onPeriodEnd: 'liquidate',
  tradingStart: '',
  tradingEnd: '',
  rules: {},
  firstLossPct: '',
  totalLossPct: '',
  stopStreak: '',
  onDailyLimit: 'liquidate',
};

const toPercentText = (ratio: number) =>
  String(Math.round(ratio * 10_000) / 100);

// 유형·성향 기본값으로 2~4단계를 채워요. 이름·유형·성향과 이미 고른 시작일은 그대로 둬요.
export function applyDefaults(
  draft: BotDraft,
  defaults: BotDefaults,
  today: string,
): BotDraft {
  return {
    ...draft,
    budgetType: defaults.budget.type,
    budgetValue:
      defaults.budget.type === 'ratio'
        ? toPercentText(defaults.budget.value)
        : String(defaults.budget.value),
    orderAmount: String(defaults.orderAmount),
    splitCount: String(defaults.splitCount),
    maxPositions: String(defaults.maxPositions),
    periodStart: draft.periodStart || today,
    tradingStart: defaults.tradingHours.start,
    tradingEnd: defaults.tradingHours.end,
    rules: Object.fromEntries(
      defaults.rules.map((field) => [field.key, String(field.value)]),
    ),
    firstLossPct: `-${defaults.lossStop.first}`,
    totalLossPct: `-${defaults.lossStop.total}`,
    stopStreak: String(defaults.stopStreak),
    onDailyLimit: defaults.onDailyLimit,
  };
}

// 입력 중인 값이 숫자가 아니면 0으로 보고 예상 배분을 계산해요.
export function toAllocationPreviewParams(
  draft: BotDraft,
): GetAllocationPreview {
  const value = Number(draft.budgetValue) || 0;
  return {
    budget: {
      type: draft.budgetType,
      value: draft.budgetType === 'ratio' ? value / 100 : value,
    },
    periodStart: draft.periodStart,
    tradingStart: draft.tradingStart,
  };
}

// POST /v1/bots 몸체. stage·status는 서버가 정해서 보내지 않아요 (FR-BOT-02)
export type CreateBot = ReturnType<typeof toCreateBot>;

export function toCreateBot(draft: BotDraft, ruleFields: RuleField[]) {
  const { budget } = toAllocationPreviewParams(draft);
  return {
    name: draft.name.trim(),
    type: draft.type,
    riskProfile: draft.riskProfile,
    budget,
    startPriority: draft.budgetType === 'fixed' ? draft.startPriority : null,
    orderAmount: Number(draft.orderAmount),
    splitCount: Number(draft.splitCount),
    maxPositions: Number(draft.maxPositions),
    period: {
      start: draft.periodStart,
      end: draft.isIndefinite ? null : draft.periodEnd,
      onEnd: draft.onPeriodEnd,
    },
    tradingHours: { start: draft.tradingStart, end: draft.tradingEnd },
    params: Object.fromEntries(
      ruleFields.map((field) => {
        const text = draft.rules[field.key] ?? '';
        return [field.key, field.kind === 'number' ? Number(text) : text];
      }),
    ),
    lossStop: {
      first: Math.abs(Number(draft.firstLossPct)),
      total: Math.abs(Number(draft.totalLossPct)),
    },
    stopStreak: Number(draft.stopStreak),
    onDailyLimit: draft.onDailyLimit,
  };
}
