'use client';

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getPnlDirection, PNL_COLOR } from '@/shared/lib';

import {
  AXIS_TICK,
  getLabelKeys,
  type PnlPoint,
  PnlTooltip,
} from './pnl-chart-parts';

const HEIGHT = 136;
const INITIAL_WIDTH = 502;

type PnlLineChartProps = {
  points: PnlPoint[];
  ariaLabel: string;
};

// 누적 손익 선(recharts LineChart). 마지막 값의 부호로 색을 정해요. 축선 아래 날짜만 둬요.
export function PnlLineChart({ points, ariaLabel }: PnlLineChartProps) {
  const last = points[points.length - 1]?.pnl ?? 0;
  const findPoint = (key: string | number | undefined) =>
    points.find((point) => point.key === key);

  return (
    <figure aria-label={ariaLabel} className="m-0">
      <ResponsiveContainer
        width="100%"
        height={HEIGHT}
        initialDimension={{ width: INITIAL_WIDTH, height: HEIGHT }}
      >
        <LineChart
          data={points}
          margin={{ top: 8, right: 20, bottom: 0, left: 20 }}
        >
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <XAxis
            dataKey="key"
            ticks={getLabelKeys(points)}
            interval={0}
            height={24}
            tickFormatter={(key: string) => findPoint(key)?.label ?? ''}
            tick={AXIS_TICK}
            axisLine={{ stroke: 'var(--sn-color-border-default)' }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--sn-color-border-strong)' }}
            isAnimationActive={false}
            content={({ active, label }) => {
              const point = active ? findPoint(label) : undefined;
              return point ? <PnlTooltip point={point} /> : null;
            }}
          />
          <Line
            dataKey="pnl"
            type="linear"
            stroke={PNL_COLOR[getPnlDirection(last)]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
