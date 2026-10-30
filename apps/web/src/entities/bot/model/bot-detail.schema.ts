import { z } from 'zod';

import { botListItemSchema } from './bot.schema';

// 상한 해제 기준 한 줄 (POL-RISK-13, FR-BOT-06)
export const releaseCriterionSchema = z.object({
  key: z.enum(['period', 'closed_trades', 'net_pnl', 'profit_factor', 'mdd']),
  // 지금 값. 아직 계산할 수 없으면 null(손익비처럼 청산이 없을 때)
  value: z.number().nullable(),
  threshold: z.number(),
  passed: z.boolean(),
});

// GET /v1/bots/:id: 목록 값 + 상세 (api.md 봇)
export const botDetailSchema = botListItemSchema.extend({
  startedAt: z.string().nullable(),
  // waiting_funds가 된 시각
  waitingSince: z.string().nullable(),
  cumulativePnl: z.number(),
  cumulativePnlRate: z.number(),
  tradingDays: z.number().int(),
  // 누적 손실 한도까지 남은 여유. 시작 전이면 null
  lossStop: z
    .object({ remaining: z.number(), limitPercent: z.number() })
    .nullable(),
  // 자금 정보 (fund-allocation.md "봇 화면에 표시할 자금 정보"). 확정 전이면 null
  funds: z
    .object({
      allocatedAt: z.string(),
      capitalAtAllocation: z.number(),
      usedAmount: z.number(),
      remainingBudget: z.number(),
      cashShare: z.number(),
      realizedPnl: z.number(),
      startPriority: z.number().int().nullable(),
      pendingReason: z.string().nullable(),
    })
    .nullable(),
  releaseCriteria: z.array(releaseCriterionSchema),
  // 지금 쓰는 규칙 값. 이름과 표시 값은 유형별 규칙을 아는 서버가 만들어요
  ruleVersion: z.object({
    version: z.number().int(),
    appliedAt: z.string(),
    values: z.array(z.object({ label: z.string(), display: z.string() })),
  }),
  holdings: z.array(
    z.object({ symbolName: z.string(), quantity: z.number().int() }),
  ),
});

// GET /v1/bots/:id/daily-results 한 줄. 그날 검증 구간이었는지 함께 줘요(FR-PERF-10)
export const botDailyResultSchema = z.object({
  tradeDate: z.string(),
  pnl: z.number(),
  verifying: z.boolean(),
});

export const botDailyResultsSchema = z.object({
  items: z.array(botDailyResultSchema),
});

export type BotDetail = z.infer<typeof botDetailSchema>;
export type ReleaseCriterion = z.infer<typeof releaseCriterionSchema>;
export type BotDailyResult = z.infer<typeof botDailyResultSchema>;
