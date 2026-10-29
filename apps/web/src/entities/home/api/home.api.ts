import { http } from '@/shared/api';

import { homeSummarySchema } from '../model/home-summary.schema';

export async function getHomeSummary() {
  return homeSummarySchema.parse(await http<unknown>('/v1/home'));
}
