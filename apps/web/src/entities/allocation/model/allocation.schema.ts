import { z } from 'zod';

const budgetSettingSchema = z.object({
  type: z.enum(['ratio', 'fixed']),
  value: z.number(),
});

// POST /v1/allocation-previews 몸체: 만들려는 봇의 투자금과 시작 시각 (FR-BOT-05)
export type GetAllocationPreview = {
  budget: z.infer<typeof budgetSettingSchema>;
  periodStart: string;
  tradingStart: string;
};

// 같은 시각에 시작하는 봇 전체의 예상 확정 결과
export const allocationPreviewSchema = z.object({
  // 운용 자산을 읽은 시각과 그때 운용 자산
  basedAt: z.string(),
  capital: z.number(),
  // 함께 시작하는 시각
  startAt: z.string(),
  // 정률 봇 비율의 합 (0~1을 넘을 수 있어요)
  ratioTotal: z.number(),
  items: z.array(
    z.object({
      // null이면 지금 만들려는 봇
      botId: z.string().nullable(),
      name: z.string().nullable(),
      budget: budgetSettingSchema,
      amount: z.number().nullable(),
      // confirmed 확정 예정 · pending 보류 예정 · blocked 저장 불가
      outcome: z.enum(['confirmed', 'pending', 'blocked']),
    }),
  ),
});
export type AllocationPreview = z.infer<typeof allocationPreviewSchema>;
