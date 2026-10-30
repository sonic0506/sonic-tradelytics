import { useSuspenseQuery } from '@tanstack/react-query';

import { botQueries } from '../api/bot.queries';
import type { GetBotStatsParams } from '../model/bot-stat.schema';

export function useBotStatsQuery(params: GetBotStatsParams) {
  return useSuspenseQuery(botQueries.stats(params));
}
