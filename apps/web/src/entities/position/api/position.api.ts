import { http } from '@/shared/api';

import {
  closedPositionsSchema,
  holdingsSchema,
} from '../model/position.schema';

export async function getHoldings() {
  return holdingsSchema.parse(
    await http<unknown>('/v1/positions?status=holding&size=100'),
  );
}

export type GetRecentClosedPositionsParams = { botId: string; size: number };

export async function getRecentClosedPositions({
  botId,
  size,
}: GetRecentClosedPositionsParams) {
  const query = new URLSearchParams({
    status: 'closed',
    botIds: botId,
    size: String(size),
  });
  return closedPositionsSchema.parse(
    await http<unknown>(`/v1/positions?${query.toString()}`),
  );
}
