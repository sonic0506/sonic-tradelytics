import { queryOptions } from '@tanstack/react-query';

import { toTradeDate } from '@/shared/lib';

import { getRiskEvents } from './risk-event.api';

export const riskEventQueries = {
  all: () => ['risk-event'] as const,
  // 홈 "리스크 이벤트" 카드: 오늘 최근 3건, 5초마다
  todayRecent: () =>
    queryOptions({
      queryKey: [...riskEventQueries.all(), 'today-recent'],
      queryFn: () => {
        const today = toTradeDate(new Date());
        return getRiskEvents({ from: today, to: today, size: 3 });
      },
      refetchInterval: 5_000,
    }),
};
