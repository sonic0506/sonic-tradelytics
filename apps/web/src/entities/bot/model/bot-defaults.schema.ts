import { z } from 'zod';

// 투자금 방식: 정률(운용 자산 대비 비율) · 정액
export const amountTypeSchema = z.enum(['ratio', 'fixed']);
export type AmountType = z.infer<typeof amountTypeSchema>;

// 운용 기간 종료(FR-BOT-08)·하루 한도 도달(POL-RISK-02) 때 들고 있는 종목 처리
export const holdingActionSchema = z.enum(['liquidate', 'hold']);
export type HoldingAction = z.infer<typeof holdingActionSchema>;

// 규칙 값 한 칸. 이름·단위·묶음은 유형별 규칙을 아는 서버가 줘요.
export const ruleFieldSchema = z.object({
  key: z.string(),
  // safety는 손실 한도·연속 손절·1회 주문 금액처럼 규칙 값 버전에 함께 저장하는 안전장치예요
  group: z.enum(['filter', 'entry', 'exit', 'safety']),
  label: z.string(),
  kind: z.enum(['number', 'time']),
  // '%', '배', '분'처럼 숫자 뒤에 붙는 단위. 시각이면 null
  unit: z.string().nullable(),
  // number면 숫자, time이면 "HH:MM"
  value: z.union([z.number(), z.string()]),
});
export type RuleField = z.infer<typeof ruleFieldSchema>;

// GET /v1/bot-defaults: 유형·성향별 기본값 (F1 1단계 자동 입력)
export const botDefaultsSchema = z.object({
  // 검증 구간에서 확정하는 투자금 상한 (POL-FUND-11)
  capAmount: z.number(),
  budget: z.object({ type: amountTypeSchema, value: z.number() }),
  orderAmount: z.number(),
  splitCount: z.number().int(),
  maxPositions: z.number().int(),
  tradingHours: z.object({ start: z.string(), end: z.string() }),
  rules: z.array(ruleFieldSchema),
  // 손실 중지 % 크기. 3이면 −3%예요 (POL-RISK-01)
  lossStop: z.object({ first: z.number(), total: z.number() }),
  stopStreak: z.number().int(),
  onDailyLimit: holdingActionSchema,
});
export type BotDefaults = z.infer<typeof botDefaultsSchema>;
