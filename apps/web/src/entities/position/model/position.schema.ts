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

export const EXIT_REASONS = [
  'take_profit',
  'stop_loss',
  'time_exit',
  'close_exit',
  'reeval_exit',
  'manual',
] as const;
export const exitReasonSchema = z.enum(EXIT_REASONS);

// GET /v1/positions?status=closed 한 줄 (청산한 포지션)
export const closedPositionSchema = z.object({
  id: z.string(),
  enteredAt: z.string(),
  exitedAt: z.string(),
  symbolName: z.string(),
  quantity: z.number().int(),
  entryPrice: z.number(),
  exitPrice: z.number(),
  netPnl: z.number(),
  exitReason: exitReasonSchema,
});

export const closedPositionsSchema = listResponseSchema(closedPositionSchema);

export type Holding = z.infer<typeof holdingSchema>;
export type ClosedPosition = z.infer<typeof closedPositionSchema>;

// 청산 사유 (glossary.md)
export const EXIT_REASON_LABEL: Record<ClosedPosition['exitReason'], string> = {
  take_profit: '익절',
  stop_loss: '손절',
  time_exit: '시간 청산',
  close_exit: '장 마감 청산',
  reeval_exit: '재평가 청산',
  manual: '수동 청산',
};
