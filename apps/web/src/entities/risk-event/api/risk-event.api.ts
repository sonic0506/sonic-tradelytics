import { http } from '@/shared/api';

import { riskEventsSchema } from '../model/risk-event.schema';

export type GetRiskEventsParams = { from: string; to: string; size: number };

export async function getRiskEvents({ from, to, size }: GetRiskEventsParams) {
  const query = new URLSearchParams({ from, to, size: String(size) });
  return riskEventsSchema.parse(
    await http<unknown>(`/v1/risk-events?${query.toString()}`),
  );
}
