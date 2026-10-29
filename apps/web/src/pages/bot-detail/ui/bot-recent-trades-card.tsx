'use client';

import {
  buttonVariants,
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

import {
  EXIT_REASON_LABEL,
  useRecentClosedPositionsQuery,
} from '@/entities/position';
import { formatMonthDayTime, formatSignedWon } from '@/shared/lib';
import { PnlText } from '@/shared/ui';

function RecentTradesFrame({
  botId,
  description,
  children,
}: {
  botId: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <CardHeader>
          <CardTitle>최근 거래</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <NextLink
          href={`/history?botIds=${botId}`}
          // sonic-ui 0.6.2 buttonVariants는 border-transparent가 남아 secondary 테두리가 사라져요. border-default로 덮어써요.
          className={`${buttonVariants({ variant: 'secondary', size: 'sm' })} shrink-0 border-default`}
        >
          투자 내역에서 보기
        </NextLink>
      </div>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

const DESKTOP_ONLY = 'max-sm:hidden';

function RecentTradesHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>진입</TableHead>
        <TableHead>종목</TableHead>
        <TableHead align="end" className={DESKTOP_ONLY}>
          수량
        </TableHead>
        <TableHead align="end" className={DESKTOP_ONLY}>
          매수가
        </TableHead>
        <TableHead align="end" className={DESKTOP_ONLY}>
          매도가
        </TableHead>
        <TableHead align="end">순손익</TableHead>
        <TableHead className={DESKTOP_ONLY}>청산 사유</TableHead>
      </TableRow>
    </TableHeader>
  );
}

// 그 봇의 청산 포지션 최근 5건. 행 이름은 투자 내역의 근거 카드로 가요.
export function BotRecentTradesCard({ botId }: { botId: string }) {
  const { data } = useRecentClosedPositionsQuery(botId);
  if (data.items.length === 0) {
    return (
      <RecentTradesFrame botId={botId} description="아직 청산한 거래가 없어요.">
        <EmptyState
          icon={<Inbox />}
          title="청산한 거래가 없어요"
          description="첫 거래를 마치면 여기에 보여요."
        />
      </RecentTradesFrame>
    );
  }
  return (
    <RecentTradesFrame
      botId={botId}
      description={`청산 거래 ${data.meta.total}건 중 최근 ${data.items.length}건이에요.`}
    >
      <Table aria-label="최근 거래">
        <RecentTradesHeader />
        <TableBody>
          {data.items.map((position) => (
            <TableRow key={position.id}>
              <TableCell className="font-mono">
                {formatMonthDayTime(position.enteredAt)}
              </TableCell>
              <TableCell>
                <NextLink
                  href={`/history/${position.id}`}
                  className="text-default hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {position.symbolName}
                </NextLink>
              </TableCell>
              <TableCell align="end" className={DESKTOP_ONLY}>
                {formatNumber(position.quantity)}
              </TableCell>
              <TableCell align="end" className={DESKTOP_ONLY}>
                {formatNumber(position.entryPrice)}
              </TableCell>
              <TableCell align="end" className={DESKTOP_ONLY}>
                {formatNumber(position.exitPrice)}
              </TableCell>
              <TableCell align="end">
                <PnlText value={position.netPnl}>
                  {formatSignedWon(position.netPnl)}
                </PnlText>
              </TableCell>
              <TableCell className={DESKTOP_ONLY}>
                {EXIT_REASON_LABEL[position.exitReason]}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </RecentTradesFrame>
  );
}

export function BotRecentTradesCardSkeleton({ botId }: { botId: string }) {
  return (
    <RecentTradesFrame botId={botId} description="최근 청산한 거래예요.">
      <div aria-busy>
        <Table>
          <RecentTradesHeader />
        </Table>
        <div className="flex flex-col gap-7 px-3 py-4">
          {[1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} shape="text" />
          ))}
        </div>
      </div>
    </RecentTradesFrame>
  );
}
