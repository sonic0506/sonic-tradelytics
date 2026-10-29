import { z } from 'zod';

// api 응답에 여러 도메인이 함께 쓰는 값 목록이에요(docs/project/glossary.md 코드 이름).
// apps/server/openapi.json이 나오면 schema.d.ts로 만든 타입으로 바꿔요(하네스 2절).
export const botTypeSchema = z.enum(['scalping', 'day', 'swing', 'closing']);
export type BotType = z.infer<typeof botTypeSchema>;

export const botStatusSchema = z.enum([
  'ready',
  'running',
  'paused',
  'waiting_funds',
  'stopped',
]);
export type BotStatus = z.infer<typeof botStatusSchema>;

export const botStageSchema = z.enum(['verifying', 'released']);
export type BotStage = z.infer<typeof botStageSchema>;

// 목록 응답 공통 모양 { items, meta } (api.md 공통 규칙)
export function listResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    meta: z.object({ page: z.number(), size: z.number(), total: z.number() }),
  });
}
