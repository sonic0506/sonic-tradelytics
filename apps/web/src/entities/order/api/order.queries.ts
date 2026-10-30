import { queryOptions } from '@tanstack/react-query';

import { toTradeDate } from '@/shared/lib';

import { getFilledOrders } from './order.api';

export const orderQueries = {
  all: () => ['order'] as const,
  // 홈 "오늘 체결" 카드: 오늘 체결 최근 5건, 5초마다
  todayRecent: () =>
    queryOptions({
      queryKey: [...orderQueries.all(), 'today-recent'],
      queryFn: () => {
        const today = toTradeDate(new Date());
        return getFilledOrders({ from: today, to: today, size: 5 });
      },
      refetchInterval: 5_000,
    }),
};
