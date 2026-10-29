'use client';

import {
  EmptyState,
  formatNumber,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@xonic0506/sonic-ui';
import { Inbox } from 'lucide-react';

import { ORDER_SIDE_LABEL, useTodayOrdersQuery } from '@/entities/order';
import { formatHourMinute } from '@/shared/lib';

function OrdersHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>시각</TableHead>
        <TableHead>종목</TableHead>
        <TableHead>구분</TableHead>
        <TableHead align="end">수량</TableHead>
        <TableHead align="end">체결가</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function TodayOrdersTable() {
  const { data } = useTodayOrdersQuery();
  if (data.items.length === 0) {
    return <EmptyState icon={<Inbox />} title="오늘 체결이 없어요" />;
  }
  return (
    <Table>
      <OrdersHeader />
      <TableBody>
        {data.items.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-mono">
              {formatHourMinute(order.filledAt)}
            </TableCell>
            <TableCell>{order.symbolName}</TableCell>
            <TableCell>{ORDER_SIDE_LABEL[order.side]}</TableCell>
            <TableCell align="end">
              {formatNumber(order.filledQuantity)}
            </TableCell>
            <TableCell align="end">
              {formatNumber(order.avgFillPrice)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TodayOrdersTableSkeleton() {
  return (
    <div aria-busy>
      <Table>
        <OrdersHeader />
      </Table>
      <div className="flex flex-col gap-7 px-3 py-4">
        {[1, 2, 3, 4, 5].map((row) => (
          <Skeleton key={row} shape="text" />
        ))}
      </div>
    </div>
  );
}
