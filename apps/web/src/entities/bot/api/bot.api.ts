import { http } from '@/shared/api';

import { botsSchema } from '../model/bot.schema';

export async function getBots() {
  return botsSchema.parse(await http<unknown>('/v1/bots?size=100'));
}
