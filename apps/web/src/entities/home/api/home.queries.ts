import { queryOptions } from '@tanstack/react-query';

import { getHomeSummary } from './home.api';

export const homeQueries = {
  all: () => ['home'] as const,
  // 홈은 5초마다 다시 불러요(api.md 홈)
  summary: () =>
    queryOptions({
      queryKey: [...homeQueries.all(), 'summary'],
      queryFn: getHomeSummary,
      refetchInterval: 5_000,
    }),
};
