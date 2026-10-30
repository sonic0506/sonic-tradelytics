'use client';

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
  formatSignedShortWon,
  getAxisMax,
  getPnlDirection,
  PNL_COLOR,
} from '@/shared/lib';

import {
  AXIS_TICK,
  CHART_CURSOR,
  getLabelKeys,
  type PnlPoint,
  PnlTooltip,
} from './pnl-chart-parts';

// Figma Chart / DailyPnlBars: 위 여백 8 + 막대 160 + X축 24
const HEIGHT = 192;
const X_AXIS_HEIGHT = 24;
// 서버 렌더링에서는 너비를 몰라서 데스크톱 카드 안쪽 너비(Figma 566)로 먼저 그려요.
const INITIAL_WIDTH = 566;

type PnlBarChartProps = {
  points: PnlPoint[];
  ariaLabel: string;
};

// 일별 손익 막대(recharts BarChart). 0선 위 상승 pnl/up, 아래 하락 pnl/down.
export function PnlBarChart({ points, ariaLabel }: PnlBarChartProps) {
  const axisMax = getAxisMax(points.map((point) => point.pnl));
  const findPoint = (key: string | number | undefined) =>
    points.find((point) => point.key === key);

  return (
    <figure aria-label={ariaLabel} className="m-0">
      <ResponsiveContainer
        width="100%"
        height={HEIGHT}
        initialDimension={{ width: INITIAL_WIDTH, height: HEIGHT }}
      >
        <BarChart
          data={points}
          margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
        >
          <YAxis
            domain={[-axisMax, axisMax]}
            ticks={[axisMax, 0, -axisMax]}
            interval={0}
            tickFormatter={formatSignedShortWon}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <XAxis
            dataKey="key"
            ticks={getLabelKeys(points)}
            interval={0}
            height={X_AXIS_HEIGHT}
            tickFormatter={(key: string) => findPoint(key)?.label ?? ''}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke="var(--sn-color-border-default)" />
          <Tooltip
            cursor={CHART_CURSOR}
            isAnimationActive={false}
            content={({ active, label }) => {
              const point = active ? findPoint(label) : undefined;
              return point ? <PnlTooltip point={point} /> : null;
            }}
          />
          {/* 움직임은 사용자 행동에만 써요(DESIGN.md §1). 막대가 자라는 애니메이션은 꺼요. */}
          <Bar
            dataKey="pnl"
            isAnimationActive={false}
            shape={(props: BarShapeProps) => (
              <Rectangle
                {...props}
                fill={PNL_COLOR[getPnlDirection(points[props.index]?.pnl ?? 0)]}
              />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
