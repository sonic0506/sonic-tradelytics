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

// 오늘 운영 상황 (FR-BOT-12). 봇 상태(status)와 따로 계산하는 값이에요
export type BotActivity =
  'trading' | 'off_hours' | 'limit_reached' | 'market_closed';
// 쉬는 중이 아닌 이유 (POL-FUND-12)
export type NotRestingReason = 'holding' | 'pending_order' | 'trading_hours';

// 실행 중·일시정지 봇만 오늘 운영 상황이 있어요. 시작 전·자금 대기·종료 봇은 null
export function botActivity(state: {
  status: string;
  statusReason: string | null;
  isTradingDay: boolean;
  // KST HH:mm:ss
  nowKst: string;
  tradingStart: string;
  tradingEnd: string;
}): BotActivity | null {
  if (state.status !== 'running' && state.status !== 'paused') return null;
  if (!state.isTradingDay) return 'market_closed';
  if (state.statusReason === 'daily_stop') return 'limit_reached';
  return state.tradingStart <= state.nowKst && state.nowKst < state.tradingEnd
    ? 'trading'
    : 'off_hours';
}

// 쉬는 중 = 실행 중·일시정지이고 보유·미체결이 없고 운영 시간 밖(장 마감 뒤·휴장·하루 한도)일 때예요.
// 실행 중·일시정지가 아니면 쉬는 중을 따지지 않아서 이유도 없어요
export function notRestingReasons(state: {
  status: string;
  activity: BotActivity | null;
  hasHoldings: boolean;
  hasOpenOrders: boolean;
}): NotRestingReason[] {
  if (state.status !== 'running' && state.status !== 'paused') return [];
  return [
    ...(state.hasHoldings ? (['holding'] as const) : []),
    ...(state.hasOpenOrders ? (['pending_order'] as const) : []),
    ...(state.activity === 'trading' ? (['trading_hours'] as const) : []),
  ];
}

export function isResting(
  status: string,
  reasons: NotRestingReason[],
): boolean {
  return (status === 'running' || status === 'paused') && reasons.length === 0;
}

// 다음 운영 날짜 (FR-BOT-12). 시각은 그 날의 운영 시작 시각이에요. 끝난 봇은 null
export function nextRunDate(state: {
  status: string;
  today: string;
  isTradingDay: boolean;
  nowKst: string;
  tradingStart: string;
  periodStart: string;
  // 오늘 다음의 첫 개장일. 모르면 null
  nextOpenDate: string | null;
}): string | null {
  if (state.status === 'stopped') return null;
  if (state.status === 'ready' && state.periodStart > state.today)
    return state.periodStart;
  if (state.isTradingDay && state.nowKst < state.tradingStart)
    return state.today;
  return state.nextOpenDate;
}
