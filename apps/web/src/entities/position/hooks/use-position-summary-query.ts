import { useSuspenseQuery } from '@tanstack/react-query';

import { positionQueries } from '../api/position.queries';
import type { GetPositionHistoryFilters } from '../model/position-history.schema';

export function usePositionSummaryQuery(filters: GetPositionHistoryFilters) {
  return useSuspenseQuery(positionQueries.summary(filters));
}
