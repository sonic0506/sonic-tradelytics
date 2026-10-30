import { describe, expect, it } from 'vitest';

import type { EngineStatus } from '../model/engine-status.schema';
import { getEngineHealth, getMarketSession } from './engine-health';

const status: EngineStatus = {
  state: 'running',
  haltReasons: [],
  heartbeatAt: '2026-10-29T14:32:05+09:00',
  staleSymbols: [],
  marketOpen: {
    isTradingDay: true,
    openAt: '2026-10-29T09:00:00+09:00',
    closeAt: '2026-10-29T15:30:00+09:00',
  },
};
const heartbeat = Date.parse(status.heartbeatAt);

describe('getEngineHealth', () => {
  it('heartbeat가 30초 안이면 실행 중이에요', () => {
    expect(getEngineHealth(status, heartbeat + 30_000)).toBe('running');
  });

  it('heartbeat가 30초를 넘으면 응답 없음이에요', () => {
    expect(getEngineHealth(status, heartbeat + 30_001)).toBe('unresponsive');
  });

  it('전체 정지는 heartbeat보다 먼저 봐요', () => {
    expect(
      getEngineHealth({ ...status, state: 'halted' }, heartbeat + 60_000),
    ).toBe('halted');
  });

  it('시세가 끊긴 종목이 있으면 알려요', () => {
    expect(
      getEngineHealth({ ...status, staleSymbols: ['005930'] }, heartbeat),
    ).toBe('feed_stale');
  });
});

describe('getMarketSession', () => {
  it('개장 시각부터 마감 시각 전까지 정규장이에요', () => {
    expect(getMarketSession(status, '2026-10-29T09:00:00+09:00')).toBe(
      'regular',
    );
    expect(getMarketSession(status, '2026-10-29T15:30:00+09:00')).toBe(
      'closed',
    );
  });

  it('거래일이 아니면 휴장이에요', () => {
    const holiday = {
      ...status,
      marketOpen: { isTradingDay: false, openAt: null, closeAt: null },
    };
    expect(getMarketSession(holiday, status.heartbeatAt)).toBe('holiday');
  });
});
