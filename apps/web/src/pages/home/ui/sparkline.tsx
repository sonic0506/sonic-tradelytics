import { getPnlDirection, PNL_TEXT_CLASS } from '@/shared/lib';

const WIDTH = 96;
const HEIGHT = 32;

// 최근 손익 흐름 96×32 (Figma Chart / Sparkline). 숫자는 옆에 있어서 장식으로 숨겨요.
export function Sparkline({ values }: { values: number[] }) {
  const first = values[0];
  const last = values[values.length - 1];
  if (first === undefined || last === undefined || values.length < 2) {
    return <span aria-hidden className="h-8 w-24 shrink-0" />;
  }
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * WIDTH;
      const y = HEIGHT - 1 - ((value - min) / range) * (HEIGHT - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`h-8 w-24 shrink-0 ${PNL_TEXT_CLASS[getPnlDirection(last - first)]}`}
      fill="none"
    >
      <polyline points={points} stroke="currentColor" strokeWidth={1} />
    </svg>
  );
}
