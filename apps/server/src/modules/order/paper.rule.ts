import { tickSize } from '@/common/market/tick-size.js';

import type { OrderSide, OrderType } from './order.constants.js';

// 개발 점검용 모의 체결 규칙 (ADR-0005). 실전보다 낙관적이라 엔진 점검에만 써요

// 종목 하나의 지금 시세. 호가가 없으면 최근 체결가로 대신해요
export interface PaperQuote {
  bestAsk: number | null;
  bestBid: number | null;
  lastPrice: number | null;
}

export interface PaperOrderTerms {
  side: OrderSide;
  orderType: OrderType;
  // 지정가. 시장가는 null
  price: number | null;
}

// 지금 체결되면 체결가, 아니면 null.
// 시장가는 상대 1호가에서 1틱 불리하게(슬리피지), 지정가는 상대 1호가가 지정가에 닿으면 그 호가로 체결해요
export function paperFillPrice(
  order: PaperOrderTerms,
  quote: PaperQuote,
): number | null {
  const isBuy = order.side === 'BUY';
  const touch = (isBuy ? quote.bestAsk : quote.bestBid) ?? quote.lastPrice;
  if (touch === null) return null;
  if (order.price === null)
    return isBuy ? touch + tickSize(touch) : touch - tickSize(touch);
  const isReached = isBuy ? touch <= order.price : touch >= order.price;
  return isReached ? touch : null;
}

export interface FeeRates {
  commissionRate: number;
  taxRate: number;
}

// 체결 금액의 수수료와 세금(매도만). 원 미만은 버려요
export function paperCosts(
  side: OrderSide,
  amount: number,
  rates: FeeRates,
): { commission: number; tax: number } {
  return {
    commission: Math.floor(amount * rates.commissionRate),
    tax: side === 'SELL' ? Math.floor(amount * rates.taxRate) : 0,
  };
}

// 손절 조건주문(SINGLE 매도): 최근 체결가가 발동가 이하로 내려오면 발동해요
export function isStopTriggered(
  triggerPrice: number,
  lastPrice: number | undefined,
): boolean {
  return lastPrice !== undefined && lastPrice <= triggerPrice;
}
