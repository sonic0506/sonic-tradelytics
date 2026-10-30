'use client';

import {
  Button,
  buttonVariants,
  Card,
  EmptyState,
  formatNumber,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@xonic0506/sonic-ui';
import { Search } from 'lucide-react';
import NextLink from 'next/link';

import { type BotStat, useBotStatsQuery } from '@/entities/bot';
import {
  formatNegativePercent,
  formatRatio,
  formatSignedPercent,
  formatSignedWon,
  formatWon,
} from '@/shared/lib';
import { PnlText } from '@/shared/ui';

import {
  type CompareSortKey,
  formatAvgHold,
  sortBotStats,
  type SortDirection,
} from '../lib/compare-sort';
import type { CompareFilters } from './compare-filter';

const COLUMNS: { key: CompareSortKey; label: string }[] = [
  { key: 'returnRate', label: '수익률' },
  { key: 'netPnl', label: '순손익' },
  { key: 'winRate', label: '승률' },
  { key: 'profitFactor', label: '손익비' },
  { key: 'mdd', label: 'MDD' },
  { key: 'avgHoldMinutes', label: '평균 보유' },
  { key: 'tradeCount', label: '거래 수' },
  { key: 'cost', label: '거래 비용' },
];

const EMPTY = <Text tone="muted">−</Text>;

function MetricCell({
  stat,
  columnKey,
}: {
  stat: BotStat;
  columnKey: CompareSortKey;
}) {
  switch (columnKey) {
    case 'returnRate':
      return stat.returnRate === null ? (
        EMPTY
      ) : (
        <PnlText value={stat.returnRate}>
          {formatSignedPercent(stat.returnRate)}
        </PnlText>
      );
    case 'netPnl':
      return stat.netPnl === null ? (
        EMPTY
      ) : (
        <PnlText value={stat.netPnl}>{formatSignedWon(stat.netPnl)}</PnlText>
      );
    case 'winRate':
      return stat.winRate === null ? EMPTY : formatRatio(stat.winRate);
    case 'profitFactor':
      return stat.profitFactor === null ? EMPTY : stat.profitFactor.toFixed(2);
    case 'mdd':
      return stat.mdd === null ? EMPTY : formatNegativePercent(stat.mdd);
    case 'avgHoldMinutes':
      return stat.avgHoldMinutes === null
        ? EMPTY
        : formatAvgHold(stat.avgHoldMinutes);
    case 'tradeCount':
      return formatNumber(stat.tradeCount);
    case 'cost':
      return formatWon(stat.cost);
  }
}

// 지수 수익률 한 줄 (FR-PERF-09). 서버가 지수를 주지 않으면 숨겨요
function Benchmark({
  benchmark,
}: {
  benchmark: { kospi: number; kosdaq: number } | null;
}) {
  if (!benchmark) return null;
  const percent = (value: number) => formatSignedPercent(value);
  return (
    <Text as="p" variant="caption" tone="muted">
      같은 기간 지수: 코스피 {percent(benchmark.kospi)} · 코스닥{' '}
      {percent(benchmark.kosdaq)}
    </Text>
  );
}

type CompareTableProps = {
  filters: CompareFilters;
  sort: { key: CompareSortKey; direction: SortDirection };
  onSort: (key: CompareSortKey) => void;
  onResetFilters: () => void;
};

// 봇별 핵심 지표 비교 (FR-PERF-02, Figma Compare). 정렬은 화면에서 해요
export function CompareTable({
  filters,
  sort,
  onSort,
  onResetFilters,
}: CompareTableProps) {
  const { data } = useBotStatsQuery({ from: filters.from, to: filters.to });
  const rows = data.items.filter(
    (stat) =>
      (filters.botIds.length === 0 ||
        filters.botIds.includes(stat.botId ?? 'manual')) &&
      (filters.stage === null || stat.stage === filters.stage),
  );
  const hasTrades = data.items.some((stat) => stat.tradeCount > 0);

  if (!hasTrades || rows.length === 0) {
    return (
      <Card>
        {hasTrades ? (
          <EmptyState
            icon={<Search />}
            title="조건에 맞는 봇이 없어요"
            description="다른 봇이나 단계를 골라 보세요."
            action={
              <Button
                variant="secondary"
                className="border-default"
                onClick={onResetFilters}
              >
                필터 초기화
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="비교할 거래가 없어요"
            description="봇이 기간 안에 거래를 하면 여기에서 성과를 비교할 수 있어요."
            action={
              <NextLink href="/bots/new" className={buttonVariants()}>
                봇 만들기
              </NextLink>
            }
          />
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Benchmark benchmark={data.benchmark} />
      <Card className="overflow-hidden p-0">
        <Table aria-label="봇 비교" className="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>봇</TableHead>
              {COLUMNS.map((column) => (
                <TableHead
                  key={column.key}
                  align="end"
                  sort={sort.key === column.key ? sort.direction : 'none'}
                  onSort={() => onSort(column.key)}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortBotStats(rows, sort.key, sort.direction).map((stat) => (
              <TableRow key={stat.botId ?? 'manual'}>
                <TableCell>
                  {stat.botId ? (
                    <NextLink
                      href={`/bots/${encodeURIComponent(stat.botId)}`}
                      className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {stat.name}
                    </NextLink>
                  ) : (
                    stat.name
                  )}
                </TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} align="end">
                    <MetricCell stat={stat} columnKey={column.key} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function CompareTableSkeleton() {
  return (
    <Card aria-busy className="gap-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} shape="rect" className="h-10" />
      ))}
    </Card>
  );
}
