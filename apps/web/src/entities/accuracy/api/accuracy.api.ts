import { http } from '@/shared/api';

import {
  accuracyStatsSchema,
  type GetAccuracyStatsParams,
} from '../model/accuracy.schema';

export async function getAccuracyStats({
  from,
  to,
  botIds,
}: GetAccuracyStatsParams) {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (botIds.length > 0) query.set('botIds', botIds.join(','));
  return accuracyStatsSchema.parse(
    await http<unknown>(`/v1/accuracy-stats?${query.toString()}`),
  );
}
