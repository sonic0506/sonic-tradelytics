import { z } from 'zod';

import { botStageSchema } from '@/shared/api';

// GET /v1/bot-stats 한 줄 (FR-PERF-02). 직접 거래도 한 줄이에요(botId null, FR-MAN-05)
// 청산이 없으면 비율 지표는 null이에요. 지표 정의는 F2 "봇별 핵심 지표"
export const botStatSchema = z.object({
  botId: z.string().nullable(),
  name: z.string(),
  stage: botStageSchema.nullable(),
  // 기간 순손익 ÷ 확정 투자금, %
  returnRate: z.number().nullable(),
  netPnl: z.number().nullable(),
  // 0~1
  winRate: z.number().nullable(),
  profitFactor: z.number().nullable(),
  // 고점 대비 최대 하락 %(양수)
  mdd: z.number().nullable(),
  avgHoldMinutes: z.number().nullable(),
  tradeCount: z.number().int(),
  cost: z.number(),
});
export type BotStat = z.infer<typeof botStatSchema>;

export const botStatsSchema = z.object({
  items: z.array(botStatSchema),
  // 같은 기간 지수 수익률(%). 지수를 저장하기 전이면 null (FR-PERF-09)
  benchmark: z.object({ kospi: z.number(), kosdaq: z.number() }).nullable(),
});

export type GetBotStatsParams = { from: string | null; to: string | null };
