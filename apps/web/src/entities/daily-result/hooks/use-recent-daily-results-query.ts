import { useSuspenseQuery } from '@tanstack/react-query';

import { dailyResultQueries } from '../api/daily-result.queries';

export function useRecentDailyResultsQuery() {
  return useSuspenseQuery(dailyResultQueries.recent());
}
