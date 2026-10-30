import { queryOptions } from '@tanstack/react-query';

import { getEngineStatus } from './engine-status.api';

export const engineStatusQueries = {
  all: () => ['engine-status'] as const,
  // 모든 화면 머리에서 10초마다 불러요(api.md engine-status)
  current: () =>
    queryOptions({
      queryKey: [...engineStatusQueries.all(), 'current'],
      queryFn: getEngineStatus,
      refetchInterval: 10_000,
    }),
};
