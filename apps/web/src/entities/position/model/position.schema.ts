import { z } from 'zod';

import { listResponseSchema } from '@/shared/api';

// GET /v1/positions?status=holding 한 줄. 직접 거래면 botName이 null이에요.
export const holdingSchema = z.object({
  id: z.string(),
  symbolCode: z.string(),
  symbolName: z.string(),
  botName: z.string().nullable(),
  quantity: z.number().int(),
  avgPrice: z.number(),
  currentPrice: z.number(),
  evaluationAmount: z.number(),
  unrealizedPnl: z.number(),
  unrealizedPnlRate: z.number(),
  // 평가 손익을 계산한 가격의 기준 시각
  quotedAt: z.string(),
});

export const holdingsSchema = listResponseSchema(holdingSchema);

export type Holding = z.infer<typeof holdingSchema>;
