// 판단에 남은 조건(규칙 id와 숫자)을 근거 카드 한 줄로 바꿔요 (F3, FR-RAT-07). 규칙 id는 전략(day-trading.rule.ts)이 정해요

interface RuleLabel {
  label: string;
  unit: '위' | '원' | '%' | 'time';
  // 통과하는 쪽
  compare: '이하' | '이상' | '이내' | '이후';
}

const RULE_LABELS: Record<string, RuleLabel> = {
  trading_amount_rank: { label: '거래대금 순위', unit: '위', compare: '이내' },
  price_min: { label: '주가 하한', unit: '원', compare: '이상' },
  price_max: { label: '주가 상한', unit: '원', compare: '이하' },
  rise_from_open_min: {
    label: '시가 대비 상승률 하한',
    unit: '%',
    compare: '이상',
  },
  rise_from_open_max: {
    label: '시가 대비 상승률 상한',
    unit: '%',
    compare: '이하',
  },
  vwap_above: { label: 'VWAP 위', unit: '%', compare: '이상' },
  vwap_band: { label: 'VWAP 위 허용 폭', unit: '%', compare: '이하' },
  exit_at: { label: '청산 시각', unit: 'time', compare: '이후' },
  stop_loss: { label: '손절가', unit: '원', compare: '이하' },
  vwap_break: { label: 'VWAP 이탈', unit: '%', compare: '이상' },
};

const MINUTES_PER_HOUR = 60;
const PAD = 2;

function format(value: number, unit: RuleLabel['unit']): string {
  if (unit === 'time') {
    const hours = String(Math.floor(value / MINUTES_PER_HOUR)).padStart(
      PAD,
      '0',
    );
    const minutes = String(value % MINUTES_PER_HOUR).padStart(PAD, '0');
    return `${hours}:${minutes}`;
  }
  if (unit === '원') return `${value.toLocaleString('ko-KR')}원`;
  return `${value}${unit}`;
}

export interface RuleCondition {
  label: string;
  // "기준 5% 이상"처럼 비교 기준
  rule: string;
  value: string;
  passed: boolean;
}

export function ruleCondition(
  result: { rule: string; value: number; threshold: number },
  passed: boolean,
): RuleCondition {
  const meta = RULE_LABELS[result.rule];
  // 모르는 규칙 id는 숫자 그대로 보여줘요
  if (!meta)
    return {
      label: result.rule,
      rule: `기준 ${result.threshold}`,
      value: String(result.value),
      passed,
    };
  return {
    label: meta.label,
    rule: `기준 ${format(result.threshold, meta.unit)} ${meta.compare}`,
    value: format(result.value, meta.unit),
    passed,
  };
}
