import { http } from '@/shared/api';

import { filledOrdersSchema } from '../model/order.schema';

export type GetFilledOrdersParams = { from: string; to: string; size: number };

export async function getFilledOrders({
  from,
  to,
  size,
}: GetFilledOrdersParams) {
  const query = new URLSearchParams({ from, to, size: String(size) });
  return filledOrdersSchema.parse(
    await http<unknown>(`/v1/orders?${query.toString()}`),
  );
}
