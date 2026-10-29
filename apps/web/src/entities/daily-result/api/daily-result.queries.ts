import { queryOptions } from '@tanstack/react-query';

import { addDays, toTradeDate } from '@/shared/lib';

import { getDailyResults } from './daily-result.api';

// 20거래일을 넉넉히 덮는 달력 날짜 수예요. 화면이 마지막 19개 + 오늘을 그려요.
const RECENT_CALENDAR_DAYS = 40;

export const dailyResultQueries = {
  all: () => ['daily-result'] as const,
  // 날짜는 부를 때 정해요. 렌더 중에 지금 시각을 읽지 않아요.
  recent: () =>
    queryOptions({
      queryKey: [...dailyResultQueries.all(), 'recent'],
      queryFn: () => {
        const now = new Date();
        return getDailyResults({
          from: toTradeDate(addDays(now, -RECENT_CALENDAR_DAYS)),
          to: toTradeDate(now),
        });
      },
    }),
};
