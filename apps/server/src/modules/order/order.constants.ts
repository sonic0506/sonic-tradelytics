// 봇 주문 / 손절 조건주문 발동 / 직접 거래 (FR-MAN-01)
export const ORDER_ORIGINS = ['bot', 'protective', 'manual'] as const;
export type OrderOrigin = (typeof ORDER_ORIGINS)[number];

export const ORDER_SIDES = ['BUY', 'SELL'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const ORDER_TYPES = ['LIMIT', 'MARKET'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const TIME_IN_FORCES = ['DAY', 'CLS', 'OPG'] as const;
export type TimeInForce = (typeof TIME_IN_FORCES)[number];

// broker_orders.status: 우리 쪽 requested·request_failed 또는 토스 OrderStatus 그대로라 CHECK를 두지 않아요.
// 미체결로 보는 상태 (POL-FUND-05, POL-RISK-16). 전이는 docs/architecture/order-lifecycle.md
export const OPEN_ORDER_STATUSES = [
  'requested',
  'PENDING',
  'PARTIAL_FILLED',
  'PENDING_CANCEL',
  'PENDING_REPLACE',
] as const;

export const ORDER_EVENT_SOURCES = ['ws', 'rest'] as const;
export type OrderEventSource = (typeof ORDER_EVENT_SOURCES)[number];

// canceling은 취소 요청 후 확인 전 (POL-RISK-14)
export const PROTECTIVE_ORDER_STATUSES = [
  'requested',
  'open',
  'canceling',
  'canceled',
  'triggered',
  'expired',
] as const;
export type ProtectiveOrderStatus = (typeof PROTECTIVE_ORDER_STATUSES)[number];

// 포지션당 하나만 살아 있을 수 있는 상태
export const LIVE_PROTECTIVE_ORDER_STATUSES = [
  'requested',
  'open',
  'canceling',
] as const;
