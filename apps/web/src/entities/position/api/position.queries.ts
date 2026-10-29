import { queryOptions } from '@tanstack/react-query';

import { getHoldings, getRecentClosedPositions } from './position.api';

export const positionQueries = {
  all: () => ['position'] as const,
  // 보유 중이 있으면 5초마다 다시 불러요(api.md 투자 내역)
  holdings: () =>
    queryOptions({
      queryKey: [...positionQueries.all(), 'holdings'],
      queryFn: getHoldings,
      refetchInterval: 5_000,
    }),
  // 봇 상세 "최근 거래": 그 봇의 청산 포지션 최근 5건
  recentClosed: (botId: string) =>
    queryOptions({
      queryKey: [...positionQueries.all(), 'recent-closed', botId],
      queryFn: () => getRecentClosedPositions({ botId, size: 5 }),
    }),
};
