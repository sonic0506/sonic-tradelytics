import { http } from '@/shared/api';

import {
  botCommandSchema,
  type CreateBotCommand,
} from '../model/bot-command.schema';

// 정지·재개·청산은 engine이 처리해요. api는 commands 행만 넣어요(api.md 원칙 2).
export async function createBotCommand({ botId, kind }: CreateBotCommand) {
  return botCommandSchema.parse(
    await http<unknown>('/v1/commands', {
      method: 'POST',
      body: JSON.stringify({ kind, botId }),
    }),
  );
}
