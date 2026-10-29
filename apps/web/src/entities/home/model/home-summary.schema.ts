import { z } from 'zod';

import { botStageSchema, botStatusSchema, botTypeSchema } from '@/shared/api';

// GET /v1/home의 봇 카드 한 줄 (api.md 홈)
export const homeBotSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: botTypeSchema,
  status: botStatusSchema,
  stage: botStageSchema,
  version: z.number().int(),
  todayPnl: z.number(),
  todayFills: z.number().int(),
  winRate30d: z.number().nullable(),
  // 확정 투자금. 확정 전(waiting_funds·ready)이면 null이고 설정값을 보여줘요
  budget: z.number().nullable(),
  budgetSetting: z.object({
    type: z.enum(['ratio', 'fixed']),
    value: z.number(),
  }),
  last7Days: z.array(z.number()),
});

export const homeSummarySchema = z.object({
  account: z.object({
    evaluationAmount: z.number(),
    orderableAmount: z.number(),
    holdingSymbolCount: z.number().int(),
    syncedAt: z.string(),
  }),
  todayPnl: z.object({ amount: z.number(), rate: z.number() }),
  botCounts: z.object({
    running: z.number().int(),
    paused: z.number().int(),
    waitingFunds: z.number().int(),
    stopped: z.number().int(),
  }),
  bots: z.array(homeBotSchema),
  fills: z.object({
    total: z.number().int(),
    buy: z.number().int(),
    sell: z.number().int(),
  }),
});

export type HomeBot = z.infer<typeof homeBotSchema>;
export type HomeSummary = z.infer<typeof homeSummarySchema>;
