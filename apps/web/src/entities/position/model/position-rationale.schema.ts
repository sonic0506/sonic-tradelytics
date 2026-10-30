import { z } from 'zod';

// 근거 카드 (F3). 조건 이름·기준·값 표시는 규칙을 아는 서버가 만들어요 (FR-RAT-07)
export const ruleConditionSchema = z.object({
  label: z.string(),
  // "기준 5% 이상"처럼 비교 기준
  rule: z.string(),
  value: z.string(),
  passed: z.boolean(),
});

// 주문 직전에 남긴 진입 판단 (FR-RAT-01)
export const entryDecisionSchema = z.object({
  decidedAt: z.string(),
  price: z.number(),
  score: z.number(),
  conditions: z.array(ruleConditionSchema),
  prediction: z.object({
    direction: z.enum(['up', 'down']),
    targetPrice: z.number(),
    targetRate: z.number(),
    stopPrice: z.number(),
    stopRate: z.number(),
    // "다음 날 09:05까지"처럼 예상 보유
    holdUntil: z.string(),
  }),
});
export type EntryDecision = z.infer<typeof entryDecisionSchema>;

// 청산 뒤 실제 결과 (FR-RAT-02)
export const positionOutcomeSchema = z.object({
  exitPrice: z.number(),
  holdingMinutes: z.number().int(),
  highPrice: z.number(),
  highAt: z.string(),
  lowPrice: z.number(),
  lowAt: z.string(),
});
export type PositionOutcome = z.infer<typeof positionOutcomeSchema>;

// 채점 (F3 채점 정의)
export const positionScoringSchema = z.object({
  directionHit: z.boolean(),
  actualDirection: z.enum(['up', 'down', 'flat']),
  // 0~100으로 자른 목표 도달률
  targetReachPct: z.number(),
  // (청산가 − 목표가) ÷ 진입가, %
  errorPct: z.number(),
});
export type PositionScoring = z.infer<typeof positionScoringSchema>;

// 진입·재평가·청산 판단을 시간순으로 (이월 봇 재평가 기록)
export const decisionTimelineSchema = z.array(
  z.object({
    at: z.string(),
    kind: z.enum(['enter', 'reeval', 'exit']),
    title: z.string(),
    detail: z.string(),
  }),
);
export type DecisionTimeline = z.infer<typeof decisionTimelineSchema>;
