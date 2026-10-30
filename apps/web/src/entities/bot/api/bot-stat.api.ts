import { http } from '@/shared/api';

import {
  botStatsSchema,
  type GetBotStatsParams,
} from '../model/bot-stat.schema';

export async function getBotStats({ from, to }: GetBotStatsParams) {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return botStatsSchema.parse(
    await http<unknown>(`/v1/bot-stats?${query.toString()}`),
  );
}
