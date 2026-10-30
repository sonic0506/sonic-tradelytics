import { useSuspenseQuery } from '@tanstack/react-query';

import { positionQueries } from '../api/position.queries';

export function useRecentClosedPositionsQuery(botId: string) {
  return useSuspenseQuery(positionQueries.recentClosed(botId));
}
