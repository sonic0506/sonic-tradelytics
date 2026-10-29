import { queryOptions } from '@tanstack/react-query';

import { getBots } from './bot.api';

export const botQueries = {
  all: () => ['bot'] as const,
  // 봇 수가 적어서 한 번에 받아 화면에서 거르고 정렬해요. 상태가 자주 바뀌어 5초마다 불러요.
  list: () =>
    queryOptions({
      queryKey: [...botQueries.all(), 'list'],
      queryFn: getBots,
      refetchInterval: 5_000,
    }),
};
