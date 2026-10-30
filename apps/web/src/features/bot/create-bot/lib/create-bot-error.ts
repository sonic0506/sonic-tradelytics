import { HttpError } from '@/shared/api';

import type { DraftErrors } from '../model/bot-draft';

type CreateBotFailure = {
  message: string;
  // 고칠 곳이 있는 단계와 입력란
  step: number | null;
  errors: DraftErrors;
};

// POST /v1/bots 실패 코드 (api.md 봇 만들기 검사)
export function describeCreateBotError(error: Error): CreateBotFailure {
  const code = error instanceof HttpError ? error.code : null;
  if (code === 'BUDGET_RATIO_EXCEEDED') {
    const message =
      '함께 시작하는 봇과 합쳐 정률이 100%를 넘어요. 투자금을 줄여 주세요.';
    return { message, step: 2, errors: { budgetValue: message } };
  }
  if (code === 'TRADING_HOURS_OUT_OF_RANGE') {
    const message = '운영 시간을 09:00~15:30 안으로 입력해 주세요.';
    return { message, step: 2, errors: { tradingStart: message } };
  }
  if (code === 'VALIDATION_FAILED') {
    return { message: '규칙 값을 확인해 주세요.', step: 3, errors: {} };
  }
  return { message: '잠시 뒤 다시 시도해 주세요.', step: null, errors: {} };
}
