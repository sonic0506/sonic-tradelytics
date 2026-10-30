import { useSuspenseQuery } from '@tanstack/react-query';

import { positionQueries } from '../api/position.queries';

export function useHoldingsQuery() {
  return useSuspenseQuery(positionQueries.holdings());
}
