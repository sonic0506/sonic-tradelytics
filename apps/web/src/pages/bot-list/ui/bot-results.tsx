'use client';

import {
  Button,
  buttonVariants,
  Card,
  EmptyState,
  Select,
  Skeleton,
  Text,
} from '@xonic0506/sonic-ui';
import NextLink from 'next/link';

import { useBotsQuery } from '@/entities/bot';
import { formatManWon } from '@/shared/lib';

import {
  BOT_SORT_KEYS,
  type BotListFilters,
  type BotSortKey,
  filterBots,
  SORT_DIRECTIONS,
  sortBots,
  type SortDirection,
} from '../lib/bot-list-order';
import { BotCardList } from './bot-card-list';
import { BotTable, BotTableHeader } from './bot-table';

// 좁은 화면 정렬 Select
const MOBILE_SORT_OPTIONS = [
  { value: 'pnl-desc', label: '오늘 손익 높은 순' },
  { value: 'pnl-asc', label: '오늘 손익 낮은 순' },
  { value: 'budget-desc', label: '투자금 많은 순' },
  { value: 'budget-asc', label: '투자금 적은 순' },
  { value: 'name-asc', label: '이름 순' },
];

function parseSortOption(value: string | null) {
  const [key, direction] = (value ?? '').split('-');
  const sortKey = BOT_SORT_KEYS.find((candidate) => candidate === key);
  const sortDirection = SORT_DIRECTIONS.find(
    (candidate) => candidate === direction,
  );
  return sortKey && sortDirection
    ? { key: sortKey, direction: sortDirection }
    : null;
}

type BotResultsProps = {
  filters: BotListFilters;
  sort: { key: BotSortKey; direction: SortDirection };
  onSort: (key: BotSortKey) => void;
  onSortChange: (sort: { key: BotSortKey; direction: SortDirection }) => void;
  onResetFilters: () => void;
};

export function BotResults({
  filters,
  sort,
  onSort,
  onSortChange,
  onResetFilters,
}: BotResultsProps) {
  const { data } = useBotsQuery();
  const [first] = data.items;

  if (!first) {
    return (
      <Card>
        <EmptyState
          title="아직 봇이 없어요"
          description="봇을 만들면 여기에서 상태와 오늘 손익을 볼 수 있어요."
          action={
            <NextLink href="/bots/new" className={buttonVariants()}>
              봇 만들기
            </NextLink>
          }
        />
      </Card>
    );
  }

  const bots = sortBots(
    filterBots(data.items, filters),
    sort.key,
    sort.direction,
  );
  if (bots.length === 0) {
    return (
      <Card>
        <EmptyState
          title="조건에 맞는 봇이 없어요"
          description="봇 이름이나 상태·단계 조건을 바꾸거나 필터를 초기화해 보세요."
          action={
            <Button variant="secondary" onClick={onResetFilters}>
              필터 초기화
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2 sm:hidden">
        <Text variant="label" tone="muted">
          정렬
        </Text>
        <div className="w-44">
          <Select
            aria-label="정렬"
            options={MOBILE_SORT_OPTIONS}
            value={`${sort.key}-${sort.direction}`}
            onValueChange={(value) => {
              const next = parseSortOption(value);
              if (next) onSortChange(next);
            }}
          />
        </div>
      </div>
      <Card className="gap-0 p-0">
        <div className="max-sm:hidden">
          <BotTable bots={bots} sort={sort} onSort={onSort} />
        </div>
        <div className="sm:hidden">
          <BotCardList bots={bots} />
        </div>
      </Card>
      <Text as="p" variant="caption" tone="muted">
        검증 중인 봇은 상한 해제 기준을 모두 통과할 때까지 투자금을{' '}
        {formatManWon(first.capAmount)}까지만 써요.
      </Text>
    </div>
  );
}

export function BotResultsSkeleton() {
  return (
    <Card aria-busy className="gap-0 p-0">
      <div className="max-sm:hidden">
        <table className="w-full">
          <BotTableHeader />
        </table>
      </div>
      <div className="flex flex-col gap-8 p-4">
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton shape="rect" className="size-10" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton shape="text" className="w-32" />
              <Skeleton shape="text" className="w-48" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
