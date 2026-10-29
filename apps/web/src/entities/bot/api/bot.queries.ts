import { queryOptions } from '@tanstack/react-query';

import { addDays, toTradeDate } from '@/shared/lib';

import { PNL_PERIOD_DAYS, type PnlPeriod } from '../model/pnl-period';
import { getBotById, getBotDailyResults, getBots } from './bot.api';

export const botQueries = {
  all: () => ['bot'] as const,
  // 봇 수가 적어서 한 번에 받아 화면에서 거르고 정렬해요. 상태가 자주 바뀌어 5초마다 불러요.
  list: () =>
    queryOptions({
      queryKey: [...botQueries.all(), 'list'],
      queryFn: getBots,
      refetchInterval: 5_000,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...botQueries.all(), 'detail', id],
      queryFn: () => getBotById(id),
      refetchInterval: 5_000,
    }),
  // 기간 시작일은 부를 때 정해요. 렌더 중에 지금 시각을 읽지 않아요.
  dailyResults: (id: string, period: PnlPeriod) =>
    queryOptions({
      queryKey: [...botQueries.all(), 'daily-results', id, { period }],
      queryFn: () => {
        const days = PNL_PERIOD_DAYS[period];
        const from =
          days === null ? null : toTradeDate(addDays(new Date(), -days));
        return getBotDailyResults({ botId: id, from });
      },
    }),
};
