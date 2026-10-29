import { z } from 'zod';

// GET /v1/daily-results: 봇 전체 일별 손익 합계 (api.md 홈)
export const dailyResultSchema = z.object({
  tradeDate: z.string(),
  pnl: z.number(),
  fees: z.number(),
  closedTrades: z.number().int(),
});

export const dailyResultsSchema = z.object({
  items: z.array(dailyResultSchema),
});

export type DailyResult = z.infer<typeof dailyResultSchema>;
