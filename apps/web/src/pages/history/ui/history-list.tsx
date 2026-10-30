'use client';

import {
  Button,
  buttonVariants,
  Card,
  EmptyState,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@xonic0506/sonic-ui';
import { Search } from 'lucide-react';
import NextLink from 'next/link';

import {
  type GetPositionHistoryParams,
  usePositionHistoryQuery,
} from '@/entities/position';
import { formatTime } from '@/shared/lib';

import { PositionRow } from './position-row';

type HistoryListProps = {
  params: GetPositionHistoryParams;
  hasFilters: boolean;
  isBotColumnVisible: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onResetFilters: () => void;
};

function Header({ isBotColumnVisible }: { isBotColumnVisible: boolean }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>
          <span className="sr-only">펼치기</span>
        </TableHead>
        <TableHead>진입</TableHead>
        <TableHead>청산</TableHead>
        {isBotColumnVisible && <TableHead>봇</TableHead>}
        <TableHead>종목</TableHead>
        <TableHead align="end">수량</TableHead>
        <TableHead align="end">매수·매도가</TableHead>
        <TableHead align="end">순손익</TableHead>
        <TableHead>상태</TableHead>
        <TableHead>청산 사유</TableHead>
        <TableHead>근거</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function GroupRow({
  label,
  columnCount,
}: {
  label: string;
  columnCount: number;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={columnCount}
        className="bg-subtle text-caption text-muted"
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

// 투자 내역 표 (Figma Card / 투자 내역). 보유 중은 맨 위에 고정해요 (FR-PERF-06)
export function HistoryList({
  params,
  hasFilters,
  isBotColumnVisible,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
}: HistoryListProps) {
  const { data } = usePositionHistoryQuery(params);
  const columnCount = isBotColumnVisible ? 11 : 10;
  const holdings = data.items.filter((item) => item.status === 'holding');
  const others = data.items.filter((item) => item.status !== 'holding');
  const pageCount = Math.max(1, Math.ceil(data.meta.total / data.meta.size));

  if (data.items.length === 0) {
    return (
      <Card className="p-0">
        <Table aria-label="투자 내역">
          <Header isBotColumnVisible={isBotColumnVisible} />
        </Table>
        {hasFilters ? (
          <EmptyState
            icon={<Search />}
            title="조건에 맞는 거래가 없어요"
            description="기간을 넓히거나 다른 조건으로 찾아보세요."
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
            title="아직 거래가 없어요"
            description="봇이 첫 거래를 하거나 앱에서 직접 거래하면 여기에 보여요."
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

  const renderRows = (rows: typeof data.items) =>
    rows.map((position) => (
      <PositionRow
        key={position.id}
        position={position}
        isBotColumnVisible={isBotColumnVisible}
        columnCount={columnCount}
      />
    ));

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <Table aria-label="투자 내역">
          <Header isBotColumnVisible={isBotColumnVisible} />
          <TableBody>
            {holdings.length > 0 && (
              <GroupRow
                columnCount={columnCount}
                label={`보유 중 ${holdings.length}${data.quotedAt ? ` · ${formatTime(data.quotedAt)} 시세 기준 평가 손익이에요` : ''}`}
              />
            )}
            {renderRows(holdings)}
            {holdings.length > 0 && others.length > 0 && (
              <GroupRow
                columnCount={columnCount}
                label="그 밖의 거래 · 최신 진입순"
              />
            )}
            {renderRows(others)}
          </TableBody>
        </Table>
      </Card>
      <Pagination
        page={data.meta.page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        pageSize={data.meta.size}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

export function HistoryListSkeleton() {
  return (
    <Card aria-busy className="gap-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} shape="rect" className="h-10" />
      ))}
    </Card>
  );
}
