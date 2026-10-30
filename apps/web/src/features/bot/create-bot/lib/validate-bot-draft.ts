import {
  getRuleValueError,
  getTradingHoursErrors,
  type RuleField,
} from '@/entities/bot';

import type { BotDraft, DraftErrors } from '../model/bot-draft';

const MAX_NAME_LENGTH = 30;

const isNumber = (text: string) =>
  text.trim() !== '' && Number.isFinite(Number(text));
const isPositive = (text: string) => isNumber(text) && Number(text) > 0;
const isCount = (text: string) =>
  isPositive(text) && Number.isInteger(Number(text));
// "-3"과 "3"을 같은 −3%로 받아요
const isLossPercent = (text: string) =>
  isNumber(text) && Number(text) !== 0 && Math.abs(Number(text)) <= 100;

function validateName(draft: BotDraft, errors: DraftErrors) {
  const name = draft.name.trim();
  if (name === '') errors.name = '봇 이름을 입력해 주세요.';
  else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `${MAX_NAME_LENGTH}자 이하로 입력해 주세요.`;
  }
}

function validateFunds(draft: BotDraft, errors: DraftErrors) {
  if (draft.budgetType === 'ratio') {
    if (!isPositive(draft.budgetValue) || Number(draft.budgetValue) > 100) {
      errors.budgetValue = '0보다 크고 100 이하인 %로 입력해 주세요.';
    }
  } else if (!isPositive(draft.budgetValue)) {
    errors.budgetValue = '0보다 큰 금액을 입력해 주세요.';
  }
  if (!isPositive(draft.orderAmount)) {
    errors.orderAmount = '0보다 큰 금액을 입력해 주세요.';
  }
  if (!isCount(draft.splitCount)) {
    errors.splitCount = '1 이상의 정수로 입력해 주세요.';
  }
  if (!isCount(draft.maxPositions)) {
    errors.maxPositions = '1 이상의 정수로 입력해 주세요.';
  }
}

function validatePeriod(draft: BotDraft, errors: DraftErrors) {
  if (draft.periodStart === '') errors.periodStart = '시작일을 골라 주세요.';
  if (draft.isIndefinite) return;
  if (draft.periodEnd === '') {
    errors.periodEnd = '종료일을 고르거나 "종료일 없이 계속 운용"을 켜 주세요.';
  } else if (draft.periodStart !== '' && draft.periodEnd < draft.periodStart) {
    errors.periodEnd = '시작일과 같거나 뒤 날짜로 골라 주세요.';
  }
}

function validateTradingHours(draft: BotDraft, errors: DraftErrors) {
  const hours = getTradingHoursErrors(draft.tradingStart, draft.tradingEnd);
  if (hours.start) errors.tradingStart = hours.start;
  if (hours.end) errors.tradingEnd = hours.end;
}

function validateRules(
  draft: BotDraft,
  ruleFields: RuleField[],
  errors: DraftErrors,
) {
  for (const field of ruleFields) {
    const error = getRuleValueError(field, draft.rules[field.key] ?? '');
    if (error) errors[`rule.${field.key}`] = error;
  }
}

function validateSafety(draft: BotDraft, errors: DraftErrors) {
  const message = '0이 아니고 100 이하인 %로 입력해 주세요.';
  if (!isLossPercent(draft.firstLossPct)) errors.firstLossPct = message;
  if (!isLossPercent(draft.totalLossPct)) errors.totalLossPct = message;
  if (!isCount(draft.stopStreak)) {
    errors.stopStreak = '1 이상의 정수로 입력해 주세요.';
  }
}

// 단계(1~4)를 넘어가기 전에 그 단계 입력만 확인해요. 빈 객체면 통과예요.
export function validateDraftStep(
  step: number,
  draft: BotDraft,
  ruleFields: RuleField[],
): DraftErrors {
  const errors: DraftErrors = {};
  if (step === 1) validateName(draft, errors);
  if (step === 2) {
    validateFunds(draft, errors);
    validatePeriod(draft, errors);
    validateTradingHours(draft, errors);
  }
  if (step === 3) validateRules(draft, ruleFields, errors);
  if (step === 4) validateSafety(draft, errors);
  return errors;
}

// 같은 시각에 시작하는 정률 봇 합이 100%를 넘으면 저장할 수 없어요 (POL-FUND-03)
export function getRatioExceededError(ratioTotal: number, ownPercent: number) {
  const totalPercent = Math.round(ratioTotal * 100);
  if (totalPercent <= 100) return null;
  const room = 100 - (totalPercent - ownPercent);
  if (room <= 0) {
    return '함께 시작하는 봇이 이미 100%를 쓰고 있어요. 정액으로 바꿔 주세요.';
  }
  return `함께 시작하는 봇과 합쳐 ${totalPercent}%예요. ${room}% 이하로 줄여 주세요.`;
}
