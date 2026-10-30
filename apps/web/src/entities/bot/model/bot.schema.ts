import { z } from 'zod';

import {
  botStageSchema,
  botStatusSchema,
  botTypeSchema,
  listResponseSchema,
} from '@/shared/api';

export const riskProfileSchema = z.enum([
  'aggressive',
  'neutral',
  'conservative',
]);

// 멈춘·기다리는 이유. 문구는 화면이 만들어요(lib/bot-descriptions.ts).
export const statusReasonSchema = z.object({
  code: z.enum([
    'consecutive_losses',
    'daily_loss_limit',
    'cumulative_loss_limit',
    'insufficient_funds',
    'manual',
    'kill_switch',
    'period_ended',
  ]),
  // 연속 손절 횟수
  count: z.number().int().nullable(),
  // 모자란 금액
  amount: z.number().nullable(),
});

// 오늘 운영 상황(FR-BOT-12). 봇 상태와 따로 계산한 값이에요.
export const botActivitySchema = z.enum([
  'trading',
  'off_hours',
  'limit_reached',
  'market_closed',
]);

// GET /v1/bots 한 줄 (api.md 봇)
export const botListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: botTypeSchema,
  riskProfile: riskProfileSchema,
  version: z.number().int(),
  status: botStatusSchema,
  statusReason: statusReasonSchema.nullable(),
  stage: botStageSchema,
  releasedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  // 검증 구간이면 상한 해제 기준 통과 수 (POL-RISK-13)
  releaseProgress: z
    .object({ passed: z.number().int(), total: z.number().int() })
    .nullable(),
  // 검증 구간 투자금 상한
  capAmount: z.number(),
  // 확정 투자금. 확정 전이면 null
  budget: z.number().nullable(),
  budgetSetting: z.object({
    type: z.enum(['ratio', 'fixed']),
    value: z.number(),
  }),
  // waiting_funds면 확정에 필요한 금액과 지금 쓸 수 있는 운용 자산 (FR-BOT-10)
  fundShortfall: z
    .object({ required: z.number(), available: z.number() })
    .nullable(),
  todayPnl: z.number(),
  todayPnlRate: z.number(),
  activity: botActivitySchema.nullable(),
  resting: z.boolean(),
  nextRunAt: z.string().nullable(),
  tradingHours: z.object({ start: z.string(), end: z.string() }),
});

export const botsSchema = listResponseSchema(botListItemSchema);

// 필터용 봇 목록 OptionDto[] (GET /v1/bots/options). 끝난 봇도 모두 와요
export const botOptionsSchema = z.array(
  z.object({ value: z.string(), label: z.string() }),
);

export type BotListItem = z.infer<typeof botListItemSchema>;
export type RiskProfile = z.infer<typeof riskProfileSchema>;
export type StatusReason = z.infer<typeof statusReasonSchema>;
