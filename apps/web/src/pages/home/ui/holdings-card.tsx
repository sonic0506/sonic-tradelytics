'use client';

import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
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
import NextLink from 'next/link';
import type { ReactNode } from 'react';

import { useHoldingsQuery } from '@/entities/position';
import {
  formatSignedNumber,
  formatSignedPercent,
  formatTime,
  getPnlDirection,
  PNL_TEXT_CLASS,
} from '@/shared/lib';

// 좁은 화면에서는 종목·평가금액·손익률만 보여 줘요(Figma Home / Holdings viewport=mobile).
const DESKTOP_ONLY = 'max-sm:hidden';

function HoldingsFrame({
  description,
  children,
}: {
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>보유 종목</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function HoldingsHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>종목</TableHead>
        <TableHead className={DESKTOP_ONLY}>봇</TableHead>
        <TableHead align="end" className={DESKTOP_ONLY}>
          수량
        </TableHead>
        <TableHead align="end" className={DESKTOP_ONLY}>
          평균가
        </TableHead>
        <TableHead align="end" className={DESKTOP_ONLY}>
          현재가
        </TableHead>
        <TableHead align="end">평가금액</TableHead>
        <TableHead align="end">
          <span className={DESKTOP_ONLY}>평가손익</span>
          <span className="sm:hidden">손익률</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function HoldingsCard() {
  const { data } = useHoldingsQuery();
  const holdings = data.items;
  const [first] = holdings;

  if (!first) {
    return (
      <HoldingsFrame description="봇과 직접 거래로 보유 중인 종목이에요.">
        <EmptyState
          icon={<Inbox />}
          title="보유 종목이 없어요"
          description="봇이 매수하면 여기에 보여요."
        />
      </HoldingsFrame>
    );
  }

  return (
    <HoldingsFrame
      description={`${holdings.length}종목 · ${formatTime(first.quotedAt)} 시세 기준`}
    >
      <Table>
        <HoldingsHeader />
        <TableBody>
          {holdings.map((holding) => {
            const pnlClass =
              PNL_TEXT_CLASS[getPnlDirection(holding.unrealizedPnl)];
            return (
              <TableRow key={holding.id}>
                <TableCell>
                  <NextLink
                    href={`/history/${holding.id}`}
                    className="text-default hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {holding.symbolName}
                  </NextLink>
                </TableCell>
                <TableCell className={DESKTOP_ONLY}>
                  {holding.botName ?? '직접 거래'}
                </TableCell>
                <TableCell align="end" className={DESKTOP_ONLY}>
                  {formatNumber(holding.quantity)}
                </TableCell>
                <TableCell align="end" className={DESKTOP_ONLY}>
                  {formatNumber(holding.avgPrice)}
                </TableCell>
                <TableCell align="end" className={DESKTOP_ONLY}>
                  {formatNumber(holding.currentPrice)}
                </TableCell>
                <TableCell align="end">
                  {formatNumber(holding.evaluationAmount)}
                </TableCell>
                <TableCell align="end" className={pnlClass}>
                  <span className={DESKTOP_ONLY}>
                    {formatSignedNumber(holding.unrealizedPnl)} (
                    {formatSignedPercent(holding.unrealizedPnlRate)})
                  </span>
                  <span className="sm:hidden">
                    {formatSignedPercent(holding.unrealizedPnlRate)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </HoldingsFrame>
  );
}

export function HoldingsCardSkeleton() {
  return (
    <HoldingsFrame description="시세 기준 시각은 불러온 뒤 보여요.">
      <div aria-busy>
        <Table>
          <HoldingsHeader />
        </Table>
        <div className="flex flex-col gap-7 px-3 py-4">
          {[1, 2, 3, 4].map((row) => (
            <Skeleton key={row} shape="text" />
          ))}
        </div>
      </div>
    </HoldingsFrame>
  );
}
