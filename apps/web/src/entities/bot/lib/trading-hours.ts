// KRX 정규장 안에서만 운영해요 (POL-RISK-15)
export const MARKET_OPEN = '09:00';
export const MARKET_CLOSE = '15:30';
const TIME_PATTERN = /^\d{2}:\d{2}$/;

// 운영 시작·종료 입력 오류. 문제가 없으면 빈 객체예요
export function getTradingHoursErrors(start: string, end: string) {
  const errors: { start?: string; end?: string } = {};
  const isInMarket = (time: string) =>
    TIME_PATTERN.test(time) && time >= MARKET_OPEN && time <= MARKET_CLOSE;
  const range = `${MARKET_OPEN}~${MARKET_CLOSE} 안으로 입력해 주세요.`;
  if (!isInMarket(start)) errors.start = range;
  if (!isInMarket(end)) errors.end = range;
  else if (start >= end)
    errors.end = '운영 시작보다 뒤 시각으로 입력해 주세요.';
  return errors;
}
