import { getTradingHoursErrors } from '@/entities/bot';

export type BasicSettingsDraft = {
  name: string;
  periodEnd: string;
  isIndefinite: boolean;
  onPeriodEnd: 'liquidate' | 'hold';
  startPriority: string | null;
  tradingStart: string;
  tradingEnd: string;
};

export type BasicSettingsErrors = Partial<
  Record<'name' | 'periodEnd' | 'tradingStart' | 'tradingEnd', string>
>;

const MAX_NAME_LENGTH = 30;

// 기본 설정 저장 전에 확인해요. 빈 객체면 통과예요
export function validateBasicSettings(
  draft: BasicSettingsDraft,
  today: string,
): BasicSettingsErrors {
  const errors: BasicSettingsErrors = {};
  const name = draft.name.trim();
  if (name === '') errors.name = '봇 이름을 입력해 주세요.';
  else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `${MAX_NAME_LENGTH}자 이하로 입력해 주세요.`;
  }
  if (!draft.isIndefinite) {
    if (draft.periodEnd === '') {
      errors.periodEnd =
        '종료일을 고르거나 "종료일 없이 계속 운용"을 켜 주세요.';
    } else if (draft.periodEnd < today) {
      errors.periodEnd = '오늘이나 그 뒤 날짜로 골라 주세요.';
    }
  }
  const hours = getTradingHoursErrors(draft.tradingStart, draft.tradingEnd);
  if (hours.start) errors.tradingStart = hours.start;
  if (hours.end) errors.tradingEnd = hours.end;
  return errors;
}
