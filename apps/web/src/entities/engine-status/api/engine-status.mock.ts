import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { EngineStatus } from '../model/engine-status.schema';

export const ENGINE_STATUS_FIXTURE: EngineStatus = {
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

export const engineStatusHandlers = [
  // 개발 화면에서 "응답 없음"이 뜨지 않게 heartbeat는 지금 시각으로 줘요.
  http.get(mockApiUrl('/v1/engine-status'), () =>
    HttpResponse.json({
      ...ENGINE_STATUS_FIXTURE,
      heartbeatAt: new Date().toISOString(),
    }),
  ),
];
