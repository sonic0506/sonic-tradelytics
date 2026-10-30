import { type BotType, http } from '@/shared/api';

import { botsSchema, type RiskProfile } from '../model/bot.schema';
import { botDefaultsSchema } from '../model/bot-defaults.schema';
import {
  botDailyResultsSchema,
  botDetailSchema,
} from '../model/bot-detail.schema';

export async function getBots() {
  return botsSchema.parse(await http<unknown>('/v1/bots?size=100'));
}

export async function getBotById(id: string) {
  return botDetailSchema.parse(
    await http<unknown>(`/v1/bots/${encodeURIComponent(id)}`),
  );
}

export type GetBotDefaultsParams = { type: BotType; riskProfile: RiskProfile };

export async function getBotDefaults({
  type,
  riskProfile,
}: GetBotDefaultsParams) {
  const query = new URLSearchParams({ type, riskProfile });
  return botDefaultsSchema.parse(
    await http<unknown>(`/v1/bot-defaults?${query.toString()}`),
  );
}

export type GetBotDailyResultsParams = { botId: string; from: string | null };

export async function getBotDailyResults({
  botId,
  from,
}: GetBotDailyResultsParams) {
  const query = from ? `?${new URLSearchParams({ from }).toString()}` : '';
  return botDailyResultsSchema.parse(
    await http<unknown>(
      `/v1/bots/${encodeURIComponent(botId)}/daily-results${query}`,
    ),
  );
}
