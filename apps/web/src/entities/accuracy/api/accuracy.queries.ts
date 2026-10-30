import { queryOptions } from '@tanstack/react-query';

import type { GetAccuracyStatsParams } from '../model/accuracy.schema';
import { getAccuracyStats } from './accuracy.api';

export const accuracyQueries = {
  all: () => ['accuracy'] as const,
  stats: (params: GetAccuracyStatsParams) =>
    queryOptions({
      queryKey: [...accuracyQueries.all(), 'stats', params],
      queryFn: () => getAccuracyStats(params),
    }),
};
