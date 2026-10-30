import { http } from '@/shared/api';

import {
  allocationPreviewSchema,
  type GetAllocationPreview,
} from '../model/allocation.schema';

// 저장하지 않고 계산만 해요(200)
export async function getAllocationPreview(params: GetAllocationPreview) {
  return allocationPreviewSchema.parse(
    await http<unknown>('/v1/allocation-previews', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  );
}
