import { queryOptions } from '@tanstack/react-query';

import type { GetAllocationPreview } from '../model/allocation.schema';
import { getAllocationPreview } from './allocation.api';

export const allocationQueries = {
  all: () => ['allocation'] as const,
  preview: (params: GetAllocationPreview) =>
    queryOptions({
      queryKey: [...allocationQueries.all(), 'preview', params],
      queryFn: () => getAllocationPreview(params),
    }),
};
