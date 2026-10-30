import { formatWon } from '@/shared/lib';

import type { RuleField } from '../model/bot-defaults.schema';

const MINUS = '−';
const TIME_PATTERN = /^\d{2}:\d{2}$/;

// 규칙 값 표시: 5% → "5%", -2% → "−2%", 2000원 → "2,000원", 10분 → "10분"
export function formatRuleValue(field: RuleField, text: string) {
  if (field.kind === 'time') return text;
  const value = Number(text);
  if (field.unit === '원') return formatWon(value);
  const sign = value < 0 ? MINUS : '';
  return `${sign}${Math.abs(value)}${field.unit ?? ''}`;
}

// 입력값이 기준 값과 다른지. 숫자는 "5"와 "5.0"을 같게 봐요.
export function isRuleChanged(field: RuleField, text: string) {
  if (field.kind === 'time') return text !== field.value;
  return text.trim() === '' || Number(text) !== Number(field.value);
}

// 규칙 값 한 칸의 입력 오류. 없으면 null
export function getRuleValueError(field: RuleField, text: string) {
  if (field.kind === 'time') {
    return TIME_PATTERN.test(text) ? null : '시각을 입력해 주세요.';
  }
  return text.trim() !== '' && Number.isFinite(Number(text))
    ? null
    : '숫자를 입력해 주세요.';
}

// 입력란 문자열을 서버에 보낼 값으로 바꿔요
export function toRuleParams(
  fields: RuleField[],
  values: Record<string, string>,
) {
  return Object.fromEntries(
    fields.map((field) => {
      const text = values[field.key] ?? '';
      return [field.key, field.kind === 'number' ? Number(text) : text];
    }),
  );
}
