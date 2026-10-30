import { useSuspenseQuery } from '@tanstack/react-query';

import { homeQueries } from '../api/home.queries';

export function useHomeSummaryQuery() {
  return useSuspenseQuery(homeQueries.summary());
}
