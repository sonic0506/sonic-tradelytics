'use client';

import { EmptyState, Skeleton } from '@xonic0506/sonic-ui';
import { Inbox } from 'lucide-react';
import {
  Bar,
  BarChart,
  type BarShapeProps,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  type DailyResult,
  useRecentDailyResultsQuery,
} from '@/entities/daily-result';
import { useHomeSummaryQuery } from '@/entities/home';
import {
  formatMonthDay,
  formatSignedManWon,
  formatSignedWon,
  getPnlDirection,
  PNL_COLOR,
} from '@/shared/lib';
import { QueryBoundary } from '@/shared/ui';

import { getAxisMax } from '../lib/chart-scale';

// 최근 20거래일: 지난 19일(daily-results) + 오늘(봇 카드 오늘 손익 합계)
const BAR_COUNT = 20;
// 축 라벨은 다섯 막대마다 하나씩, 그리고 마지막(오늘)에 써요
const LABEL_EVERY = 5;
// Figma: 위 여백 8 + 막대 160 + X축 24
const PLOT_HEIGHT = 192;
const X_AXIS_HEIGHT = 24;
// 데스크톱 일별 손익 카드 안쪽 너비(Figma 566)
const INITIAL_WIDTH = 566;
// 축 글자: mono-caption + text/muted (Figma Chart / DailyPnlBars)
const AXIS_TICK = {
  className: 'fill-(--sn-color-text-muted) font-mono text-caption',
};

type PnlDatum = { key: string; label: string; pnl: number };

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
  const data: PnlDatum[] = history.map((result) => ({
    key: result.tradeDate,
    label: formatMonthDay(result.tradeDate),
    pnl: result.pnl,
  }));
  if (todayPnl !== null)
    data.push({ key: 'today', label: '오늘', pnl: todayPnl });
  const axisMax = getAxisMax(data.map((datum) => datum.pnl));
  const labelKeys = data
    .filter(
      (_, index) => index % LABEL_EVERY === 0 || index === data.length - 1,
    )
    .map((datum) => datum.key);
  const findDatum = (key: string | number | undefined) =>
    data.find((datum) => datum.key === key);

  return (
    <figure aria-label={`최근 ${data.length}거래일 일별 손익`} className="m-0">
      {/* 서버 렌더링에서는 너비를 몰라서, 데스크톱 카드 너비로 먼저 그린 뒤 실제 너비로 맞춰요 */}
      <ResponsiveContainer
        width="100%"
        height={PLOT_HEIGHT}
        initialDimension={{ width: INITIAL_WIDTH, height: PLOT_HEIGHT }}
      >
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <YAxis
            domain={[-axisMax, axisMax]}
            ticks={[axisMax, 0, -axisMax]}
            interval={0}
            tickFormatter={formatSignedManWon}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <XAxis
            dataKey="key"
            ticks={labelKeys}
            interval={0}
            height={X_AXIS_HEIGHT}
            tickFormatter={(key: string) => findDatum(key)?.label ?? ''}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke="var(--sn-color-border-default)" />
          <Tooltip
            cursor={{ fill: 'var(--sn-color-bg-subtle)' }}
            isAnimationActive={false}
            content={({ active, label }) => {
              const datum = active ? findDatum(label) : undefined;
              return datum ? <PnlTooltip datum={datum} /> : null;
            }}
          />
          {/* 움직임은 사용자 행동에만 써요(DESIGN.md §1). 막대가 자라는 애니메이션은 꺼요. */}
          <Bar
            dataKey="pnl"
            isAnimationActive={false}
            shape={(props: BarShapeProps) => (
              <Rectangle
                {...props}
                fill={PNL_COLOR[getPnlDirection(data[props.index]?.pnl ?? 0)]}
              />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

// sonic Tooltip과 같은 모양: bg/inverse + text/inverse, caption, radius/md
function PnlTooltip({ datum }: { datum: PnlDatum }) {
  return (
    <div className="rounded-md bg-inverse px-2 py-1 text-caption text-inverse">
      {datum.label}{' '}
      <span className="font-mono">{formatSignedWon(datum.pnl)}</span>
    </div>
  );
}

export function DailyPnlChartSkeleton() {
  return <Skeleton shape="rect" className="h-48" />;
}
