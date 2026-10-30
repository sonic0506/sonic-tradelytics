import { z } from 'zod';

// POST /v1/commands 응답: 넣은 commands 행 (api.md 공통)
export const botCommandSchema = z.object({
  id: z.string(),
  kind: z.string(),
  handledAt: z.string().nullable(),
});

export type BotCommandKind = 'pause' | 'resume' | 'liquidate';

export type CreateBotCommand = { botId: string; kind: BotCommandKind };
