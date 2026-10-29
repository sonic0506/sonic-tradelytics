import { z } from 'zod';

// GET /v1/engine-status (api.md 공통)
export const engineStatusSchema = z.object({
  state: z.enum(['running', 'stopping', 'halted']),
  haltReasons: z.array(z.string()),
  heartbeatAt: z.string(),
  staleSymbols: z.array(z.string()),
  marketOpen: z.object({
    isTradingDay: z.boolean(),
    openAt: z.string().nullable(),
    closeAt: z.string().nullable(),
  }),
});

export type EngineStatus = z.infer<typeof engineStatusSchema>;
