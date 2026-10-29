'use client';

import { EmptyState, Skeleton, Tooltip } from '@xonic0506/sonic-ui';
import { Inbox } from 'lucide-react';

import {
  type DailyResult,
  useRecentDailyResultsQuery,
} from '@/entities/daily-result';
import { useHomeSummaryQuery } from '@/entities/home';
import {
  formatMonthDay,
  formatSignedManWon,
  formatSignedWon,
} from '@/shared/lib';
import { QueryBoundary } from '@/shared/ui';

import { getAxisMax } from '../lib/chart-scale';

// 최근 20거래일: 지난 19일(daily-results) + 오늘(봇 카드 오늘 손익 합계)
const BAR_COUNT = 20;
// 축 라벨은 다섯 막대마다 하나씩 써요
const LABEL_EVERY = 5;

type Bar = { key: string; label: string; pnl: number };

export function DailyPnlChart() {
  const { data } = useRecentDailyResultsQuery();
  const history = data.items.slice(-(BAR_COUNT - 1));
  if (history.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="손익 기록이 아직 없어요"
        description="봇이 하루를 마치면 막대가 생겨요."
      />
    );
  }
  // 오늘 막대는 홈 요약에서 받아요. 홈 요약이 실패해도 지난 막대는 그대로 보여 줘요(api.md 홈).
  const historyOnly = <DailyPnlBars history={history} todayPnl={null} />;
  return (
    <QueryBoundary
      loading={historyOnly}
      errorTitle="오늘 손익을 불러오지 못했어요"
      errorFallback={historyOnly}
    >
      <DailyPnlWithToday history={history} />
    </QueryBoundary>
  );
}

function DailyPnlWithToday({ history }: { history: DailyResult[] }) {
  const { data: home } = useHomeSummaryQuery();
  const todayPnl = home.bots.reduce((sum, bot) => sum + bot.todayPnl, 0);
  return <DailyPnlBars history={history} todayPnl={todayPnl} />;
}

type DailyPnlBarsProps = {
  history: DailyResult[];
  todayPnl: number | null;
};

function DailyPnlBars({ history, todayPnl }: DailyPnlBarsProps) {
  const bars: Bar[] = history.map((result) => ({
    key: result.tradeDate,
    label: formatMonthDay(result.tradeDate),
    pnl: result.pnl,
  }));
  if (todayPnl !== null)
    bars.push({ key: 'today', label: '오늘', pnl: todayPnl });
  const axisMax = getAxisMax(bars.map((bar) => bar.pnl));

  return (
    <figure
      aria-label={`최근 ${bars.length}거래일 일별 손익`}
      className="m-0 flex flex-col gap-2"
    >
      <div className="flex h-40 gap-2">
        <div
          aria-hidden
          className="flex w-10 shrink-0 flex-col justify-between text-right font-mono text-caption text-muted"
        >
          <span>{formatSignedManWon(axisMax)}</span>
          <span>0</span>
          <span>{formatSignedManWon(-axisMax)}</span>
        </div>
        <div className="relative flex flex-1 gap-2">
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 border-t border-default"
          />
          {bars.map((bar) => (
            <PnlBar key={bar.key} bar={bar} axisMax={axisMax} />
          ))}
        </div>
      </div>
      <div
        aria-hidden
        className="flex gap-2 pl-12 font-mono text-caption text-muted"
      >
        {bars.map((bar, index) => (
          <span key={bar.key} className="flex-1 text-center whitespace-nowrap">
            {index % LABEL_EVERY === 0 || index === bars.length - 1
              ? bar.label
              : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

function PnlBar({ bar, axisMax }: { bar: Bar; axisMax: number }) {
  const summary = `${bar.label} ${formatSignedWon(bar.pnl)}`;
  // 0선 위아래로 반씩 써요
  const heightPercent = Math.min(Math.abs(bar.pnl) / axisMax, 1) * 50;
  return (
    <Tooltip content={summary}>
      <span
        role="img"
        aria-label={summary}
        tabIndex={0}
        className="relative flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span
          aria-hidden
          className={`absolute inset-x-0 ${bar.pnl >= 0 ? 'bottom-1/2 bg-pnl-up' : 'top-1/2 bg-pnl-down'}`}
          style={{ height: `${heightPercent}%` }}
        />
      </span>
    </Tooltip>
  );
}

export function DailyPnlChartSkeleton() {
  return <Skeleton shape="rect" className="h-48" />;
}
