import { useSuspenseQuery } from '@tanstack/react-query';

import { accuracyQueries } from '../api/accuracy.queries';
import type { GetAccuracyStatsParams } from '../model/accuracy.schema';

export function useAccuracyStatsQuery(params: GetAccuracyStatsParams) {
  return useSuspenseQuery(accuracyQueries.stats(params));
}
