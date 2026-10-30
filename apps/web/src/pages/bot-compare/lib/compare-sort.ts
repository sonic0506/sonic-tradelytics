import type { BotStat } from '@/entities/bot';

export const COMPARE_SORT_KEYS = [
  'returnRate',
  'netPnl',
  'winRate',
  'profitFactor',
  'mdd',
  'avgHoldMinutes',
  'tradeCount',
  'cost',
] as const;
export type CompareSortKey = (typeof COMPARE_SORT_KEYS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

// 값이 없는 봇(거래 0건)은 방향과 상관없이 맨 아래에 둬요
export function sortBotStats(
  rows: BotStat[],
  key: CompareSortKey,
  direction: SortDirection,
) {
  const sign = direction === 'asc' ? 1 : -1;
  return rows.toSorted((a, b) => {
    const left = a[key];
    const right = b[key];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return (left - right) * sign;
  });
}

// 같은 열을 다시 누르면 방향을 바꾸고, 다른 열은 큰 값부터 보여 줘요
export function getNextCompareSort(
  current: { key: CompareSortKey; direction: SortDirection },
  key: CompareSortKey,
) {
  if (current.key !== key) return { key, direction: 'desc' as const };
  return {
    key,
    direction:
      current.direction === 'desc' ? ('asc' as const) : ('desc' as const),
  };
}

// 47분, 17시간 40분, 6.2일
export function formatAvgHold(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  if (minutes < 1_440) {
    const rest = minutes % 60;
    return `${Math.floor(minutes / 60)}시간${rest > 0 ? ` ${rest}분` : ''}`;
  }
  return `${(minutes / 1_440).toFixed(1)}일`;
}
