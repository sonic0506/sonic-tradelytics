import { z } from 'zod';

// POST /v1/commands 응답: 넣은 commands 행 (api.md 공통)
export const commandSchema = z.object({
  id: z.string(),
  kind: z.string(),
  handledAt: z.string().nullable(),
});

export type CreateKillCommand = {
  // 보유 종목도 모두 시장가로 청산할지
  liquidateAll: boolean;
};
