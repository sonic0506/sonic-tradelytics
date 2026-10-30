'use client';

import { Badge, Button, TableCell, TableRow, Text } from '@xonic0506/sonic-ui';
import { formatNumber } from '@xonic0506/sonic-ui';
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import NextLink from 'next/link';
import { useState } from 'react';

import { BOT_TYPE_LABEL } from '@/entities/bot';
import {
  EXIT_REASON_LABEL,
  type PositionRow as Row,
} from '@/entities/position';
import {
  formatHourMinute,
  formatMonthDay,
  formatSignedPercent,
  formatSignedWon,
  toTradeDate,
} from '@/shared/lib';
import { PnlText, QueryBoundary } from '@/shared/ui';

import { STATUS_BADGE } from '../lib/history-text';
import { PositionOrders, PositionOrdersSkeleton } from './position-orders';

function DateTime({ iso }: { iso: string | null }) {
  if (!iso) return <Text tone="muted">−</Text>;
  return (
    <span className="flex flex-col font-mono text-caption text-default">
      <span>{formatMonthDay(toTradeDate(new Date(iso)))}</span>
      <span>{formatHourMinute(iso)}</span>
    </span>
  );
}

type PositionRowProps = {
  position: Row;
  isBotColumnVisible: boolean;
  columnCount: number;
};

// 거래 한 줄 = 포지션 하나. 펼치면 주문이 보여요 (Figma History / PositionRow)
export function PositionRow({
  position,
  isBotColumnVisible,
  columnCount,
}: PositionRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const badge = STATUS_BADGE[position.status];
  const secondPrice = position.exitPrice ?? position.currentPrice;
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <>
      <TableRow>
        <TableCell>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${position.symbolName} 주문 ${isOpen ? '접기' : '펼치기'}`}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <Chevron />
          </Button>
        </TableCell>
        <TableCell>
          <DateTime iso={position.enteredAt} />
        </TableCell>
        <TableCell>
          <DateTime iso={position.exitedAt} />
        </TableCell>
        {isBotColumnVisible && (
          <TableCell>
            <span className="flex flex-col">
              <span>{position.botName ?? '직접 거래'}</span>
              <span className="text-caption text-muted">
                {position.botType
                  ? BOT_TYPE_LABEL[position.botType]
                  : '앱에서 주문'}
              </span>
            </span>
          </TableCell>
        )}
        <TableCell>
          <span className="flex flex-col">
            <span>{position.symbolName}</span>
            <span className="font-mono text-caption text-muted">
              {position.symbolCode}
            </span>
          </span>
        </TableCell>
        <TableCell align="end">{position.quantity}</TableCell>
        <TableCell align="end">
          <span className="flex flex-col items-end">
            <span>{formatNumber(position.entryPrice)}</span>
            <span className="text-caption text-muted">
              {secondPrice === null ? '−' : formatNumber(secondPrice)}
            </span>
          </span>
        </TableCell>
        <TableCell align="end">
          <span className="flex flex-col items-end">
            <PnlText value={position.netPnl}>
              {formatSignedWon(position.netPnl)}
            </PnlText>
            <PnlText value={position.netPnl} variant="mono-caption">
              {formatSignedPercent(position.netPnlRate)}
            </PnlText>
          </span>
        </TableCell>
        <TableCell>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </TableCell>
        <TableCell>
          {position.exitReason ? EXIT_REASON_LABEL[position.exitReason] : '−'}
        </TableCell>
        <TableCell>
          <NextLink
            href={`/history/${encodeURIComponent(position.id)}`}
            aria-label={`${position.symbolName} 근거 보기`}
            className="flex size-7 items-center justify-center rounded-md text-default hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ScrollText className="size-4" aria-hidden />
          </NextLink>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={columnCount} className="bg-subtle p-5">
            <QueryBoundary
              loading={<PositionOrdersSkeleton />}
              errorTitle="주문을 불러오지 못했어요"
              isCompact
            >
              <PositionOrders positionId={position.id} />
            </QueryBoundary>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
