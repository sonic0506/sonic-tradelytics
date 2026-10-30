'use client';

import {
  Badge,
  Button,
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
  Text,
} from '@xonic0506/sonic-ui';
import { Search } from 'lucide-react';

import {
  type GetRiskEventHistoryParams,
  type RiskEvent,
  useRiskEventHistoryQuery,
} from '@/entities/risk-event';
import { formatHourMinute, formatMonthDayTime } from '@/shared/lib';

import { OPS_KIND_BADGE } from '../lib/ops-text';

function NotifiedText({ event }: { event: RiskEvent }) {
  return event.notifiedAt ? (
    <Text>{formatHourMinute(event.notifiedAt)} 보냄</Text>
  ) : (
    <Text tone="muted">보내지 않음</Text>
  );
}

function KindBadge({ event }: { event: RiskEvent }) {
  const badge = OPS_KIND_BADGE[event.kind];
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

type RiskEventListProps = {
  params: GetRiskEventHistoryParams;
  hasFilters: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onResetFilters: () => void;
};

// 리스크·장애 이벤트와 알림 발송 여부 (POL-RISK-12, Figma Ops). 좁은 화면은 카드 목록이에요
export function RiskEventList({
  params,
  hasFilters,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
}: RiskEventListProps) {
  const { data } = useRiskEventHistoryQuery(params);
  const pageCount = Math.max(1, Math.ceil(data.meta.total / data.meta.size));

  if (data.items.length === 0) {
    return (
      <Card>
        {hasFilters ? (
          <EmptyState
            icon={<Search />}
            title="조건에 맞는 기록이 없어요"
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
            title="리스크 이벤트가 없어요"
            description="한도에 닿거나 장애가 생기면 여기에 기록하고 알려 드려요."
          />
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0 max-sm:hidden">
        <Table aria-label="리스크 이벤트">
          <TableHeader>
            <TableRow>
              <TableHead>시각</TableHead>
              <TableHead>종류</TableHead>
              <TableHead>봇</TableHead>
              <TableHead>내용</TableHead>
              <TableHead>알림</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{formatMonthDayTime(event.occurredAt)}</TableCell>
                <TableCell>
                  <KindBadge event={event} />
                </TableCell>
                <TableCell>{event.botName ?? '전체'}</TableCell>
                <TableCell>{event.message}</TableCell>
                <TableCell>
                  <NotifiedText event={event} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card className="p-0 sm:hidden">
        <ul aria-label="리스크 이벤트" className="flex flex-col">
          {data.items.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-2 border-b border-default p-4 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <KindBadge event={event} />
                <Text className="flex-1 truncate">
                  {event.botName ?? '전체'}
                </Text>
                <Text variant="mono-caption" tone="muted">
                  {formatMonthDayTime(event.occurredAt)}
                </Text>
              </div>
              <Text as="p">{event.message}</Text>
              <span className="text-caption">
                <NotifiedText event={event} />
              </span>
            </li>
          ))}
        </ul>
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

export function RiskEventListSkeleton() {
  return (
    <Card aria-busy className="gap-4">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <Skeleton shape="text" className="w-36" />
          <Skeleton shape="text" className="w-18" />
        </div>
      ))}
    </Card>
  );
}
