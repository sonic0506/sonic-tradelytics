import { useSuspenseQuery } from '@tanstack/react-query';

import { orderQueries } from '../api/order.queries';

export function useTodayOrdersQuery() {
  return useSuspenseQuery(orderQueries.todayRecent());
}
