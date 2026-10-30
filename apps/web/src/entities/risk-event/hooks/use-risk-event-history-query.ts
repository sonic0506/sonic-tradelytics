import { useSuspenseQuery } from '@tanstack/react-query';

import { riskEventQueries } from '../api/risk-event.queries';
import type { GetRiskEventHistoryParams } from '../api/risk-event-history.api';

export function useRiskEventHistoryQuery(params: GetRiskEventHistoryParams) {
  return useSuspenseQuery(riskEventQueries.history(params));
}
