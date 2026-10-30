import { queryOptions } from '@tanstack/react-query';

import type {
  GetPositionHistoryFilters,
  GetPositionHistoryParams,
} from '../model/position-history.schema';
import { getHoldings, getRecentClosedPositions } from './position.api';
import {
  getPositionDetail,
  getPositionHistory,
  getPositionSummary,
} from './position-history.api';

export const positionQueries = {
  all: () => ['position'] as const,
  // 보유 중이 있으면 5초마다 다시 불러요(api.md 투자 내역)
  holdings: () =>
    queryOptions({
      queryKey: [...positionQueries.all(), 'holdings'],
      queryFn: getHoldings,
      refetchInterval: 5_000,
    }),
  // 투자 내역. 보유 중이 있으면 평가 손익을 5초마다 다시 불러요 (FR-PERF-06)
  history: (params: GetPositionHistoryParams) =>
    queryOptions({
      queryKey: [...positionQueries.all(), 'history', params],
      queryFn: () => getPositionHistory(params),
      refetchInterval: (query) =>
        query.state.data?.items.some((item) => item.status === 'holding')
          ? 5_000
          : false,
    }),
  summary: (filters: GetPositionHistoryFilters) =>
    queryOptions({
      queryKey: [...positionQueries.all(), 'summary', filters],
      queryFn: () => getPositionSummary(filters),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...positionQueries.all(), 'detail', id],
      queryFn: () => getPositionDetail(id),
    }),
  // 봇 상세 "최근 거래": 그 봇의 청산 포지션 최근 5건
  recentClosed: (botId: string) =>
    queryOptions({
      queryKey: [...positionQueries.all(), 'recent-closed', botId],
      queryFn: () => getRecentClosedPositions({ botId, size: 5 }),
    }),
};
