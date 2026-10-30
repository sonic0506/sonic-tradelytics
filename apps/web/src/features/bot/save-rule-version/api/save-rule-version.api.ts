import { z } from 'zod';

import type { RuleParams } from '@/entities/bot';
import { http } from '@/shared/api';

export type SaveRuleVersion = { botId: string; params: RuleParams };

const savedVersionSchema = z.object({ version: z.number().int() });

// 새 버전을 추가해요(201). 쉬는 중이면 engine이 바로 적용하고, 아니면 쉬는 중이 될 때 적용해요
export async function saveRuleVersion({ botId, params }: SaveRuleVersion) {
  return savedVersionSchema.parse(
    await http<unknown>(`/v1/bots/${encodeURIComponent(botId)}/versions`, {
      method: 'POST',
      body: JSON.stringify({ params }),
    }),
  );
}
