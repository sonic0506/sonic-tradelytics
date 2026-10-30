'use client';

import { Card, Skeleton, Text } from '@xonic0506/sonic-ui';
import { formatNumber } from '@xonic0506/sonic-ui';
import {
  ArrowLeftRight,
  Banknote,
  ChartColumn,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import {
  type GetPositionHistoryFilters,
  usePositionSummaryQuery,
} from '@/entities/position';
import {
  formatSignedNumber,
  formatSignedPercent,
  formatSignedWon,
  formatWon,
} from '@/shared/lib';
import { KpiCard, PnlText } from '@/shared/ui';

const GRID = 'grid grid-cols-2 gap-4 lg:grid-cols-4';

// 내역 위 요약 (Figma History Summary). 봇 하나를 고르면 그 봇의 자금을 보여 줘요
export function HistorySummary({
  filters,
}: {
  filters: GetPositionHistoryFilters;
}) {
  const { data: summary } = usePositionSummaryQuery(filters);

  if (summary.kind === 'bot') {
    return (
      <div className={GRID}>
        <KpiCard
          icon={Wallet}
          label="확정 투자금"
          value={<Text variant="title">{formatWon(summary.budget)}</Text>}
          detail={
            <Text variant="mono-caption" tone="muted">
              사용 중 {formatWon(summary.usedAmount)}
            </Text>
          }
        />
        <KpiCard
          icon={Banknote}
          label="남은 한도"
          value={
            <Text variant="title">{formatWon(summary.remainingBudget)}</Text>
          }
          detail={
            <Text variant="mono-caption" tone="muted">
              {summary.capAmount === null
                ? '상한 해제'
                : `검증 상한 ${formatWon(summary.capAmount)}`}
            </Text>
          }
        />
        <KpiCard
          icon={ChartColumn}
          label="누적 손익"
          value={
            <PnlText value={summary.cumulativePnl} variant="title">
              {formatSignedWon(summary.cumulativePnl)}
            </PnlText>
          }
          detail={
            <PnlText value={summary.cumulativePnl} variant="mono-caption">
              {formatSignedPercent(summary.cumulativePnlRate)} ·{' '}
              {summary.tradingDays}거래일
            </PnlText>
          }
        />
        <KpiCard
          icon={ShieldAlert}
          label="손실 중지까지"
          value={
            <Text variant="title">{formatWon(summary.lossStopRemaining)}</Text>
          }
          detail={
            <Text variant="mono-caption" tone="muted">
              누적 한도 −{summary.lossLimitPercent}% 기준
            </Text>
          }
        />
      </div>
    );
  }

  return (
    <div className={GRID}>
      <KpiCard
        icon={ArrowLeftRight}
        label="거래 수"
        value={<Text variant="title">{summary.tradeCount}건</Text>}
        detail={
          <Text variant="mono-caption" tone="muted">
            보유 {summary.holdingCount} · 청산 {summary.closedCount} 외
          </Text>
        }
      />
      <KpiCard
        icon={TrendingUp}
        label="순손익"
        value={
          <PnlText value={summary.netPnl} variant="title">
            {formatSignedWon(summary.netPnl)}
          </PnlText>
        }
        detail={
          <Text variant="mono-caption" tone="muted">
            평가 {formatSignedNumber(summary.unrealizedPnl)} 포함
          </Text>
        }
      />
      <KpiCard
        icon={Banknote}
        label="거래 비용"
        value={<Text variant="title">{formatWon(summary.cost)}</Text>}
        detail={
          <Text variant="mono-caption" tone="muted">
            세금 {formatNumber(summary.tax)} 포함
          </Text>
        }
      />
      <Card className="gap-2">
        <Text variant="caption" tone="muted">
          봇별 손익
        </Text>
        <dl className="flex flex-col gap-2">
          {summary.botPnls.map((bot) => (
            <div
              key={bot.botId ?? 'manual'}
              className="flex justify-between gap-2"
            >
              <dt className="truncate text-caption text-default">{bot.name}</dt>
              <dd>
                <PnlText value={bot.pnl} variant="mono-caption">
                  {formatSignedWon(bot.pnl)}
                </PnlText>
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

export function HistorySummarySkeleton() {
  return (
    <div aria-busy className={GRID}>
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="gap-2">
          <Skeleton shape="text" className="w-16" />
          <Skeleton shape="text" className="h-7 w-24" />
          <Skeleton shape="text" className="w-28" />
        </Card>
      ))}
    </div>
  );
}
