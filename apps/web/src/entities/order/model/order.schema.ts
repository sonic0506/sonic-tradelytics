import { z } from 'zod';

import { listResponseSchema } from '@/shared/api';

// GET /v1/orders 한 줄: 체결된 주문 (api.md 홈)
export const filledOrderSchema = z.object({
  id: z.string(),
  filledAt: z.string(),
  symbolCode: z.string(),
  symbolName: z.string(),
  botName: z.string().nullable(),
  side: z.enum(['BUY', 'SELL']),
  filledQuantity: z.number().int(),
  avgFillPrice: z.number(),
  origin: z.enum(['bot', 'protective', 'manual']),
  positionId: z.string(),
});

export const filledOrdersSchema = listResponseSchema(filledOrderSchema);

export type FilledOrder = z.infer<typeof filledOrderSchema>;

export const ORDER_SIDE_LABEL: Record<FilledOrder['side'], string> = {
  BUY: '매수',
  SELL: '매도',
};
