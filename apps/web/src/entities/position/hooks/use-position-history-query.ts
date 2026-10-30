import { useSuspenseQuery } from '@tanstack/react-query';

import { positionQueries } from '../api/position.queries';
import type { GetPositionHistoryParams } from '../model/position-history.schema';

export function usePositionHistoryQuery(params: GetPositionHistoryParams) {
  return useSuspenseQuery(positionQueries.history(params));
}
