import type { BotStage, BotStatus } from '@/shared/api';

export const BOT_SORT_KEYS = [
  'name',
  'status',
  'stage',
  'budget',
  'pnl',
] as const;
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type BotSortKey = (typeof BOT_SORT_KEYS)[number];
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export type BotListFilters = {
  q: string;
  status: BotStatus | null;
  stage: BotStage | null;
};

type SortableBot = {
  name: string;
  status: BotStatus;
  stage: BotStage;
  budget: number | null;
  todayPnl: number;
};

// 상태는 손이 많이 가는 순서(실행 중 → 일시정지 → 자금 대기 → 시작 대기 → 종료)
const STATUS_ORDER: Record<BotStatus, number> = {
  running: 0,
  paused: 1,
  waiting_funds: 2,
  ready: 3,
  stopped: 4,
};
const STAGE_ORDER: Record<BotStage, number> = { verifying: 0, released: 1 };

function compareBy(a: SortableBot, b: SortableBot, key: BotSortKey) {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name, 'ko');
    case 'status':
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case 'stage':
      return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
    case 'budget':
      return (a.budget ?? 0) - (b.budget ?? 0);
    case 'pnl':
      return a.todayPnl - b.todayPnl;
  }
}

// 같은 값이면 이름순으로 둬서 순서가 흔들리지 않게 해요.
export function sortBots<T extends SortableBot>(
  bots: T[],
  key: BotSortKey,
  direction: SortDirection,
) {
  const sign = direction === 'asc' ? 1 : -1;
  return [...bots].sort(
    (a, b) => sign * compareBy(a, b, key) || a.name.localeCompare(b.name, 'ko'),
  );
}

export function filterBots<T extends SortableBot>(
  bots: T[],
  filters: BotListFilters,
) {
  const keyword = filters.q.trim();
  return bots.filter(
    (bot) =>
      (keyword === '' || bot.name.includes(keyword)) &&
      (filters.status === null || bot.status === filters.status) &&
      (filters.stage === null || bot.stage === filters.stage),
  );
}

export function hasActiveFilters(filters: BotListFilters) {
  return (
    filters.q.trim() !== '' || filters.status !== null || filters.stage !== null
  );
}

// 같은 열을 다시 누르면 방향만 바꿔요. 새 열은 글자 열이면 오름차순, 숫자 열이면 내림차순으로 시작해요.
export function getNextSort(
  current: { key: BotSortKey; direction: SortDirection },
  key: BotSortKey,
): { key: BotSortKey; direction: SortDirection } {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: key === 'budget' || key === 'pnl' ? 'desc' : 'asc' };
}
