import { http } from '@/shared/api';

import { botsSchema } from '../model/bot.schema';
import {
  botDailyResultsSchema,
  botDetailSchema,
} from '../model/bot-detail.schema';

export async function getBots() {
  return botsSchema.parse(await http<unknown>('/v1/bots?size=100'));
}

export async function getBotById(id: string) {
  return botDetailSchema.parse(await http<unknown>(`/v1/bots/${id}`));
}

export type GetBotDailyResultsParams = { botId: string; from: string | null };

export async function getBotDailyResults({
  botId,
  from,
}: GetBotDailyResultsParams) {
  const query = from ? `?${new URLSearchParams({ from }).toString()}` : '';
  return botDailyResultsSchema.parse(
    await http<unknown>(`/v1/bots/${botId}/daily-results${query}`),
  );
}
