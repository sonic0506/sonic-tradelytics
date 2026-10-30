import { z } from 'zod';

const rateSchema = z.number().min(0).max(1);

// 건너뛴 판단 사유 (data-model decisions.skip_reason)
export const SKIP_REASONS = [
  'entry_condition',
  'risk',
  'funds',
  'symbol_lock',
  'market_alert',
  'order_rejected',
  'rate_limit',
] as const;

// GET /v1/accuracy-stats (FR-RAT-05, 06). Should 섹션은 구현 전까지 응답에 없어요
export const accuracyStatsSchema = z.object({
  summary: z.object({
    scoredCount: z.number().int(),
    directionHitRate: rateSchema,
    targetReachRate: rateSchema,
    bots: z.array(
      z.object({
        botId: z.string(),
        name: z.string(),
        scoredCount: z.number().int(),
        directionHitRate: rateSchema,
        targetReachRate: rateSchema,
        // 평균 예측 오차, %
        avgErrorPct: z.number(),
      }),
    ),
  }),
  // 신뢰 점수 구간(높은 구간부터)별 청산 수와 승률
  scoreBuckets: z.array(
    z.object({
      min: z.number().int(),
      max: z.number().int(),
      closedCount: z.number().int(),
      winRate: rateSchema,
    }),
  ),
  // 조건(규칙)별 충족 시 승률·평균 손익. 이름은 규칙을 아는 서버가 만들어요
  conditions: z
    .array(
      z.object({
        label: z.string(),
        tradeCount: z.number().int(),
        winRate: rateSchema,
        avgPnlRate: z.number(),
      }),
    )
    .optional(),
  skipped: z
    .array(
      z.object({
        reason: z.enum(SKIP_REASONS),
        count: z.number().int(),
        // 그날 종가까지 평균 등락, %
        avgChangePct: z.number(),
      }),
    )
    .optional(),
  reeval: z
    .object({
      initialHitRate: rateSchema,
      initialCount: z.number().int(),
      reevalHitRate: rateSchema,
      reevalCount: z.number().int(),
    })
    .optional(),
});
export type AccuracyStats = z.infer<typeof accuracyStatsSchema>;
export type SkipReason = (typeof SKIP_REASONS)[number];

export type GetAccuracyStatsParams = {
  from: string | null;
  to: string | null;
  botIds: string[];
};

// 건너뛴 판단 사유 문구 (Figma Accuracy / 건너뛴 판단)
export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  entry_condition: '진입 조건 미달',
  market_alert: '진입 금지 종목 (VI·투자경고 등)',
  symbol_lock: '종목 잠금 (다른 봇이 보유)',
  risk: '하루 손실 한도 도달',
  funds: '자금 부족',
  order_rejected: '주문 거부',
  rate_limit: '호출 한도 초과',
};
