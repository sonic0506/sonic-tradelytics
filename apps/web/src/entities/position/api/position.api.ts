import { http } from '@/shared/api';

import { holdingsSchema } from '../model/position.schema';

export async function getHoldings() {
  return holdingsSchema.parse(
    await http<unknown>('/v1/positions?status=holding&size=100'),
  );
}
