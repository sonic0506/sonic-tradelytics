import type {
  ExitReason,
  PositionStatus,
  PositionView,
} from './position.constants.js';

// 포지션의 화면 상태 (api.md GET /v1/positions)
export function positionView(position: {
  status: PositionStatus;
  quantity: number;
  exitReason: ExitReason | null;
}): PositionView {
  if (position.status === 'open')
    return position.quantity > 0 ? 'holding' : 'pending';
  return position.exitReason === 'not_filled' ? 'canceled' : 'closed';
}
