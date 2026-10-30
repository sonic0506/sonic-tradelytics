import { queryOptions } from '@tanstack/react-query';

import { addDays, toTradeDate } from '@/shared/lib';

import type { GetBotStatsParams } from '../model/bot-stat.schema';
import type { GetVersionPreview } from '../model/bot-version.schema';
import { PNL_PERIOD_DAYS, type PnlPeriod } from '../model/pnl-period';
import {
  getBotById,
  getBotDailyResults,
  getBotDefaults,
  type GetBotDefaultsParams,
  getBotOptions,
  getBots,
} from './bot.api';
import { getBotStats } from './bot-stat.api';
import { getBotVersions, getVersionPreview } from './bot-version.api';

export const botQueries = {
  all: () => ['bot'] as const,
  // 봇 수가 적어서 한 번에 받아 화면에서 거르고 정렬해요. 상태가 자주 바뀌어 5초마다 불러요.
  list: () =>
    queryOptions({
      queryKey: [...botQueries.all(), 'list'],
      queryFn: getBots,
      refetchInterval: 5_000,
    }),
  // 필터 선택지. 봇 이름은 잘 바뀌지 않아서 1분 동안 다시 받지 않아요
  options: () =>
    queryOptions({
      queryKey: [...botQueries.all(), 'options'],
      queryFn: getBotOptions,
      staleTime: 60_000,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...botQueries.all(), 'detail', id],
      queryFn: () => getBotById(id),
      refetchInterval: 5_000,
    }),
  // 봇 비교 표 (FR-PERF-02)
  stats: (params: GetBotStatsParams) =>
    queryOptions({
      queryKey: [...botQueries.all(), 'stats', params],
      queryFn: () => getBotStats(params),
    }),
  versions: (id: string) =>
    queryOptions({
      queryKey: [...botQueries.all(), 'versions', id],
      queryFn: () => getBotVersions(id),
    }),
  // 바꾸려는 값마다 서버가 결과를 계산해요. 저장하지 않아요
  versionPreview: (params: GetVersionPreview) =>
    queryOptions({
      queryKey: [...botQueries.all(), 'version-preview', params],
      queryFn: () => getVersionPreview(params),
    }),
  // 유형·성향별 기본값은 코드 상수라 다시 받지 않아요.
  defaults: (params: GetBotDefaultsParams) =>
    queryOptions({
      queryKey: [...botQueries.all(), 'defaults', params],
      queryFn: () => getBotDefaults(params),
      staleTime: Infinity,
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
