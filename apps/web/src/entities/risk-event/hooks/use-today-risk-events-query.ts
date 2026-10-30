import { useSuspenseQuery } from '@tanstack/react-query';

import { riskEventQueries } from '../api/risk-event.queries';

export function useTodayRiskEventsQuery() {
  return useSuspenseQuery(riskEventQueries.todayRecent());
}
