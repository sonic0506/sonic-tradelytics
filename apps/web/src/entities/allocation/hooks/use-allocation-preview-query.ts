import { useSuspenseQuery } from '@tanstack/react-query';

import { allocationQueries } from '../api/allocation.queries';
import type { GetAllocationPreview } from '../model/allocation.schema';

export function useAllocationPreviewQuery(params: GetAllocationPreview) {
  return useSuspenseQuery(allocationQueries.preview(params));
}
