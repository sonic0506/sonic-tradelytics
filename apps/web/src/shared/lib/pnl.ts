export type PnlDirection = 'up' | 'down' | 'flat';

export function getPnlDirection(value: number): PnlDirection {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

// 손익 글자색. globals.css의 --app-pnl-* 별칭이에요.
export const PNL_TEXT_CLASS: Record<PnlDirection, string> = {
  up: 'text-pnl-up',
  down: 'text-pnl-down',
  flat: 'text-pnl-flat',
};
