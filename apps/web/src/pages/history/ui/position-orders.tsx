'use client';

import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@xonic0506/sonic-ui';
import { formatNumber } from '@xonic0506/sonic-ui';

import { usePositionDetailQuery } from '@/entities/position';
import { formatMonthDayTime } from '@/shared/lib';

import {
  getOrderKindText,
  getOrderStatusText,
  ORIGIN_LABEL,
} from '../lib/history-text';

// 펼친 거래의 주문과 주문별 체결 합계 (FR-PERF-04, Figma Expanded / 주문)
export function PositionOrders({ positionId }: { positionId: string }) {
  const { data } = usePositionDetailQuery(positionId);
  return (
    <div className="flex flex-col gap-2">
      <Text as="p" variant="caption" tone="muted">
        주문 {data.orders.length}건 · 체결 합계예요
      </Text>
      <div className="rounded-lg border border-default bg-surface">
        <Table aria-label="주문" className="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>구분</TableHead>
              <TableHead>시각</TableHead>
              <TableHead align="end">수량</TableHead>
              <TableHead align="end">평균가</TableHead>
              <TableHead align="end">수수료</TableHead>
              <TableHead align="end">세금</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>출처</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{getOrderKindText(order)}</TableCell>
                <TableCell>{formatMonthDayTime(order.orderedAt)}</TableCell>
                <TableCell align="end">{order.quantity}</TableCell>
                <TableCell align="end">
                  {order.avgPrice === null ? '−' : formatNumber(order.avgPrice)}
                </TableCell>
                <TableCell align="end">
                  {formatNumber(order.commission)}
                </TableCell>
                <TableCell align="end">{formatNumber(order.tax)}</TableCell>
                <TableCell>{getOrderStatusText(order)}</TableCell>
                <TableCell>{ORIGIN_LABEL[order.origin]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function PositionOrdersSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-2">
      <Skeleton shape="text" className="w-28" />
      <Skeleton shape="rect" />
    </div>
  );
}
