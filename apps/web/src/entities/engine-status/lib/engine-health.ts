import type { EngineStatus } from '../model/engine-status.schema';

// heartbeat가 이보다 오래되면 "엔진 응답 없음"이에요(api.md engine-status).
const HEARTBEAT_STALE_MS = 30_000;

export type EngineHealth = 'running' | 'halted' | 'unresponsive' | 'feed_stale';

export function getEngineHealth(
  status: EngineStatus,
  now: number,
): EngineHealth {
  if (status.state === 'halted') return 'halted';
  if (now - Date.parse(status.heartbeatAt) > HEARTBEAT_STALE_MS) {
    return 'unresponsive';
  }
  if (status.staleSymbols.length > 0) return 'feed_stale';
  return 'running';
}

export type MarketSession = 'regular' | 'closed' | 'holiday';

export const MARKET_SESSION_LABEL: Record<MarketSession, string> = {
  regular: '정규장',
  closed: '장 마감',
  holiday: '휴장',
};

// at 시각이 오늘 정규장 안인지 봐요.
export function getMarketSession(
  { marketOpen }: EngineStatus,
  at: string,
): MarketSession {
  const { isTradingDay, openAt, closeAt } = marketOpen;
  if (!isTradingDay || !openAt || !closeAt) return 'holiday';
  const time = Date.parse(at);
  const isOpen = time >= Date.parse(openAt) && time < Date.parse(closeAt);
  return isOpen ? 'regular' : 'closed';
}
