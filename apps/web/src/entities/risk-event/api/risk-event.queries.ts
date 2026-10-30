import { queryOptions } from '@tanstack/react-query';

import { toTradeDate } from '@/shared/lib';

import { getRiskEvents } from './risk-event.api';
import {
  getRiskEventHistory,
  type GetRiskEventHistoryParams,
} from './risk-event-history.api';

export const riskEventQueries = {
  all: () => ['risk-event'] as const,
  // 운영 화면 기록. 새 사건을 놓치지 않게 10초마다 다시 불러요
  history: (params: GetRiskEventHistoryParams) =>
    queryOptions({
      queryKey: [...riskEventQueries.all(), 'history', params],
      queryFn: () => getRiskEventHistory(params),
      refetchInterval: 10_000,
    }),
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
