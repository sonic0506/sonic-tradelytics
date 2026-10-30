'use client';

import { Line, LineChart, YAxis } from 'recharts';

import { getPnlDirection, PNL_COLOR } from '@/shared/lib';

const WIDTH = 96;
const HEIGHT = 32;

// 최근 손익 흐름 96×32 (Figma Chart / Sparkline). 숫자는 옆에 있어서 장식으로 숨겨요.
export function Sparkline({ values }: { values: number[] }) {
  const first = values[0];
  const last = values[values.length - 1];
  if (first === undefined || last === undefined || values.length < 2) {
    return <span aria-hidden className="h-8 w-24 shrink-0" />;
  }
  const data = values.map((pnl, index) => ({ index, pnl }));
  return (
    <div aria-hidden className="h-8 w-24 shrink-0">
      <LineChart
        width={WIDTH}
        height={HEIGHT}
        data={data}
        margin={{ top: 1, right: 1, bottom: 1, left: 1 }}
        accessibilityLayer={false}
      >
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Line
          dataKey="pnl"
          type="linear"
          stroke={PNL_COLOR[getPnlDirection(last - first)]}
          strokeWidth={1}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  );
}
