import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { DailyResult } from '../model/daily-result.schema';

const SAMPLE: [string, number][] = [
  ['2026-10-01', 48_000],
  ['2026-10-02', -16_000],
  ['2026-10-05', 72_000],
  ['2026-10-06', 9_500],
  ['2026-10-07', -38_000],
  ['2026-10-08', 98_000],
  ['2026-10-12', 24_000],
  ['2026-10-13', -6_000],
  ['2026-10-14', 61_000],
  ['2026-10-15', 79_000],
  ['2026-10-16', -27_000],
  ['2026-10-19', 18_000],
  ['2026-10-20', 41_000],
  ['2026-10-21', -64_000],
  ['2026-10-22', 22_000],
  ['2026-10-23', 112_000],
  ['2026-10-26', -12_000],
  ['2026-10-27', 54_000],
  ['2026-10-28', 66_000],
];

export const DAILY_RESULTS_FIXTURE: DailyResult[] = SAMPLE.map(
  ([tradeDate, pnl]) => ({ tradeDate, pnl, fees: 1_200, closedTrades: 3 }),
);

export const dailyResultHandlers = [
  http.get(mockApiUrl('/v1/daily-results'), () =>
    HttpResponse.json({ items: DAILY_RESULTS_FIXTURE }),
  ),
];
