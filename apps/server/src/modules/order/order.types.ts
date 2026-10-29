import type { OrderSide, OrderType, TimeInForce } from './order.constants.js';

// 토스 주문 1건의 현재 값(REST 주문 조회, personal:order 이벤트의 order). 체결 값은 주문 전체의 누적이에요
export interface OrderReport {
  brokerOrderId: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  timeInForce: TimeInForce;
  status: string;
  price: number | null;
  quantity: number;
  filledQuantity: number;
  avgFilledPrice: number | null;
  filledAmount: number | null;
  commission: number | null;
  tax: number | null;
  orderedAt: Date;
  canceledAt: Date | null;
  // 웹소켓 이벤트에는 없어요
  filledAt: Date | null;
  settlementDate: string | null;
  raw: Record<string, unknown>;
}

// applyReport 결과. pending_recovery는 응답을 못 받은 봇 주문일 수 있어 분류하지 않고 둔 주문이에요
export type ApplyResult =
  'unchanged' | 'updated' | 'created' | 'ignored' | 'pending_recovery';
