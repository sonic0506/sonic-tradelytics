// 봇 설정 검사 규칙 (POL-RISK-15)

// KRX 정규장 (HH:mm:ss)
const REGULAR_OPEN = '09:00:00';
const REGULAR_CLOSE = '15:30:00';
const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

// "HH:mm" 또는 "HH:mm:ss"를 Postgres time 문자열("HH:mm:ss")로. 시각이 아니면 null
export function toTimeOfDay(text: string): string | null {
  const match = TIME.exec(text);
  if (!match) return null;
  const [, hours = '', minutes = '', seconds = '00'] = match;
  return `${hours}:${minutes}:${seconds}`;
}

// 운영 시간은 정규장(09:00~15:30) 안이고 시작 < 종료예요
export function isTradingHoursValid(start: string, end: string): boolean {
  return REGULAR_OPEN <= start && start < end && end <= REGULAR_CLOSE;
}
