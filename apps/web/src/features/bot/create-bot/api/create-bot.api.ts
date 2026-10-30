import { z } from 'zod';

import { http } from '@/shared/api';

import type { CreateBot } from '../model/bot-draft';

const createdBotSchema = z.object({ id: z.string() });

// 봇과 첫 규칙 버전을 함께 저장해요(201). 시작은 engine이 운용 기간 첫날 운영 시작 시각에 해요.
export async function createBot(body: CreateBot) {
  return createdBotSchema.parse(
    await http<unknown>('/v1/bots', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}
