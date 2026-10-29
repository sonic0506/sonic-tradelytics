import { queryOptions } from '@tanstack/react-query';

import { getHoldings } from './position.api';

export const positionQueries = {
  all: () => ['position'] as const,
  // 보유 중이 있으면 5초마다 다시 불러요(api.md 투자 내역)
  holdings: () =>
    queryOptions({
      queryKey: [...positionQueries.all(), 'holdings'],
      queryFn: getHoldings,
      refetchInterval: 5_000,
    }),
};
