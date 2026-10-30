import { useSuspenseQuery } from '@tanstack/react-query';

import { botQueries } from '../api/bot.queries';

export function useBotVersionsQuery(botId: string) {
  return useSuspenseQuery(botQueries.versions(botId));
}
