import { useSuspenseQuery } from '@tanstack/react-query';

import { positionQueries } from '../api/position.queries';

export function usePositionDetailQuery(id: string) {
  return useSuspenseQuery(positionQueries.detail(id));
}
