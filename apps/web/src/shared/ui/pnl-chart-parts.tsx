'use client';

import { formatSignedWon } from '@/shared/lib';

// 손익 차트 공통: 축 글자 mono-caption + text/muted, 툴팁은 sonic Tooltip 모양
export const AXIS_TICK = {
  className: 'fill-(--sn-color-text-muted) font-mono text-caption',
};

export const CHART_CURSOR = { fill: 'var(--sn-color-bg-subtle)' };

export type PnlPoint = { key: string; label: string; pnl: number };

// 축 라벨은 다섯 칸마다 하나씩(점이 많으면 다섯 개 안팎이 되게 벌려요), 그리고 마지막 칸에 둬요.
export function getLabelKeys(points: PnlPoint[]) {
  const every = points.length > 25 ? Math.ceil(points.length / 5) : 5;
  return points
    .filter((_, index) => index % every === 0 || index === points.length - 1)
    .map((point) => point.key);
}

// bg/inverse + text/inverse, caption, radius/md (DESIGN.md §10 Tooltip)
export function PnlTooltip({ point }: { point: PnlPoint }) {
  return (
    <div className="rounded-md bg-inverse px-2 py-1 text-caption text-inverse">
      {point.label}{' '}
      <span className="font-mono">{formatSignedWon(point.pnl)}</span>
    </div>
  );
}
