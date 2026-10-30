import { z } from 'zod';

import { botTypeSchema, listResponseSchema } from '@/shared/api';

import { exitReasonSchema } from './position.schema';
import {
  decisionTimelineSchema,
  entryDecisionSchema,
  positionOutcomeSchema,
  positionScoringSchema,
} from './position-rationale.schema';

// 화면 상태 (api.md 투자 내역): 보유 중 · 미체결 · 청산 완료 · 취소
export const POSITION_STATUSES = [
  'holding',
  'pending',
  'closed',
  'canceled',
] as const;
export const positionStatusSchema = z.enum(POSITION_STATUSES);
export type PositionStatus = z.infer<typeof positionStatusSchema>;

export const POSITION_RESULTS = ['profit', 'loss'] as const;
export const positionResultSchema = z.enum(POSITION_RESULTS);
export type PositionResult = z.infer<typeof positionResultSchema>;

// GET /v1/positions 투자 내역 한 줄 = 진입부터 청산까지 포지션 하나 (FR-PERF-04)
export const positionRowSchema = z.object({
  id: z.string(),
  enteredAt: z.string(),
  exitedAt: z.string().nullable(),
  // 직접 거래면 봇이 없어요 (FR-PERF-07)
  botId: z.string().nullable(),
  botName: z.string().nullable(),
  botType: botTypeSchema.nullable(),
  symbolCode: z.string(),
  symbolName: z.string(),
  quantity: z.number().int(),
  entryPrice: z.number(),
  exitPrice: z.number().nullable(),
  // 보유 중이면 평가 손익을 계산한 지금 가격
  currentPrice: z.number().nullable(),
  // 수수료·세금을 뺀 손익. 보유 중이면 평가 손익
  netPnl: z.number(),
  netPnlRate: z.number(),
  status: positionStatusSchema,
  exitReason: exitReasonSchema.nullable(),
});
export type PositionRow = z.infer<typeof positionRowSchema>;

// 보유 중은 첫 페이지 맨 위에 모두 넣어 줘요. quotedAt은 평가 가격의 기준 시각
export const positionHistorySchema = listResponseSchema(
  positionRowSchema,
).extend({ quotedAt: z.string().nullable() });
export type PositionHistory = z.infer<typeof positionHistorySchema>;

// 투자 내역 필터 (FR-PERF-05). botIds에 'manual'을 넣으면 직접 거래예요
export type GetPositionHistoryFilters = {
  from: string | null;
  to: string | null;
  botIds: string[];
  symbol: string;
  result: PositionResult | null;
  status: PositionStatus | null;
  exitReason: z.infer<typeof exitReasonSchema> | null;
};
export type GetPositionHistoryParams = GetPositionHistoryFilters & {
  page: number;
  size: number;
};

// GET /v1/position-summaries: 봇 하나면 그 봇의 자금, 아니면 전체 요약
export const positionSummarySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('overall'),
    tradeCount: z.number().int(),
    holdingCount: z.number().int(),
    closedCount: z.number().int(),
    netPnl: z.number(),
    unrealizedPnl: z.number(),
    cost: z.number(),
    tax: z.number(),
    botPnls: z.array(
      z.object({
        botId: z.string().nullable(),
        name: z.string(),
        pnl: z.number(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('bot'),
    budget: z.number(),
    usedAmount: z.number(),
    remainingBudget: z.number(),
    capAmount: z.number().nullable(),
    cumulativePnl: z.number(),
    cumulativePnlRate: z.number(),
    tradingDays: z.number().int(),
    lossStopRemaining: z.number(),
    lossLimitPercent: z.number(),
  }),
]);
export type PositionSummary = z.infer<typeof positionSummarySchema>;

// GET /v1/positions/:id 주문 목록 (FR-PERF-04)
export const positionOrderSchema = z.object({
  id: z.string(),
  side: z.enum(['BUY', 'SELL']),
  // stop_condition은 손절 조건주문(보호 주문)이에요
  kind: z.enum(['normal', 'stop_condition']),
  orderedAt: z.string(),
  quantity: z.number().int(),
  avgPrice: z.number().nullable(),
  commission: z.number(),
  tax: z.number(),
  status: z.enum(['filled', 'partial', 'pending', 'canceled']),
  // 취소·체결된 시각
  statusAt: z.string().nullable(),
  origin: z.enum(['bot', 'protective', 'manual']),
});
export type PositionOrder = z.infer<typeof positionOrderSchema>;

// GET /v1/positions/:id: 펼친 거래의 주문과 근거 카드 (api.md, F3)
export const positionDetailSchema = z.object({
  id: z.string(),
  position: positionRowSchema,
  // 판단에 쓴 규칙 값 버전. 직접 거래면 null
  botVersion: z.number().int().nullable(),
  orders: z.array(positionOrderSchema),
  // 직접 거래면 판단 기록이 없어요
  entry: entryDecisionSchema.nullable(),
  // 청산 전이면 결과와 채점이 비어 있어요
  outcome: positionOutcomeSchema.nullable(),
  scoring: positionScoringSchema.nullable(),
  timeline: decisionTimelineSchema,
});
