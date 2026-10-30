'use client';

import { Skeleton, Text } from '@xonic0506/sonic-ui';
import { ArrowLeftRight, Banknote, TrendingUp, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

import { useHomeSummaryQuery } from '@/entities/home';
import { formatSignedPercent, formatSignedWon, formatWon } from '@/shared/lib';
import { PnlText } from '@/shared/ui';

import { KpiCard } from './kpi-card';

function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
  );
}

function Detail({ children }: { children: ReactNode }) {
  return (
    <Text variant="mono-caption" tone="muted">
      {children}
    </Text>
  );
}

export function HomeKpis() {
  const { data: home } = useHomeSummaryQuery();
  const { account, todayPnl, fills } = home;
  const orderableShare =
    account.evaluationAmount > 0
      ? (account.orderableAmount / account.evaluationAmount) * 100
      : 0;
  return (
    <KpiGrid>
      <KpiCard
        icon={Wallet}
        label="평가금액"
        value={
          <Text variant="title">{formatWon(account.evaluationAmount)}</Text>
        }
        detail={<Detail>보유 {account.holdingSymbolCount}종목</Detail>}
      />
      <KpiCard
        icon={TrendingUp}
        label="오늘 손익"
        value={
          <PnlText value={todayPnl.amount} variant="title">
            {formatSignedWon(todayPnl.amount)}
          </PnlText>
        }
        detail={
          <PnlText value={todayPnl.amount} variant="mono-caption">
            {formatSignedPercent(todayPnl.rate)}
          </PnlText>
        }
      />
      <KpiCard
        icon={Banknote}
        label="주문 가능 금액"
        value={
          <Text variant="title">{formatWon(account.orderableAmount)}</Text>
        }
        detail={<Detail>평가금액의 {orderableShare.toFixed(1)}%</Detail>}
      />
      <KpiCard
        icon={ArrowLeftRight}
        label="오늘 체결"
        value={<Text variant="title">{fills.total}건</Text>}
        detail={
          <Detail>
            {fills.total > 0
              ? `매수 ${fills.buy} · 매도 ${fills.sell}`
              : '아직 체결이 없어요'}
          </Detail>
        }
      />
    </KpiGrid>
  );
}

const KPI_SKELETONS = [
  { icon: Wallet, label: '평가금액' },
  { icon: TrendingUp, label: '오늘 손익' },
  { icon: Banknote, label: '주문 가능 금액' },
  { icon: ArrowLeftRight, label: '오늘 체결' },
];

export function HomeKpisSkeleton() {
  return (
    <div aria-busy>
      <KpiGrid>
        {KPI_SKELETONS.map(({ icon, label }) => (
          <KpiCard
            key={label}
            icon={icon}
            label={label}
            value={<Skeleton shape="text" className="my-2 w-28" />}
            detail={<Skeleton shape="text" className="w-16" />}
          />
        ))}
      </KpiGrid>
    </div>
  );
}
