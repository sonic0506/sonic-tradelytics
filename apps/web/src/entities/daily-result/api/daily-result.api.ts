import { http } from '@/shared/api';

import { dailyResultsSchema } from '../model/daily-result.schema';

export type GetDailyResultsParams = { from: string; to: string };

export async function getDailyResults({ from, to }: GetDailyResultsParams) {
  const query = new URLSearchParams({ from, to });
  return dailyResultsSchema.parse(
    await http<unknown>(`/v1/daily-results?${query.toString()}`),
  );
}
