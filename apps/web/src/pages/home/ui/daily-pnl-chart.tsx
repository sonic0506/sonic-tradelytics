'use client';

import { EmptyState, Skeleton } from '@xonic0506/sonic-ui';
import { Inbox } from 'lucide-react';

import {
  type DailyResult,
  useRecentDailyResultsQuery,
} from '@/entities/daily-result';
import { useHomeSummaryQuery } from '@/entities/home';
import { formatMonthDay } from '@/shared/lib';
import { PnlBarChart, type PnlPoint, QueryBoundary } from '@/shared/ui';

// 최근 20거래일: 지난 19일(daily-results) + 오늘(봇 카드 오늘 손익 합계)
const BAR_COUNT = 20;

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

function DailyPnlBars({
  history,
  todayPnl,
}: {
  history: DailyResult[];
  todayPnl: number | null;
}) {
  const points: PnlPoint[] = history.map((result) => ({
    key: result.tradeDate,
    label: formatMonthDay(result.tradeDate),
    pnl: result.pnl,
  }));
  if (todayPnl !== null)
    points.push({ key: 'today', label: '오늘', pnl: todayPnl });
  return (
    <PnlBarChart
      points={points}
      ariaLabel={`최근 ${points.length}거래일 일별 손익`}
    />
  );
}

export function DailyPnlChartSkeleton() {
  return <Skeleton shape="rect" className="h-48" />;
}
