import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';
import { TossApiError } from '@/infra/toss/toss.errors.js';

import type { OrderSide, OrderType } from './order.constants.js';

export interface PlaceOrder {
  // = 판단 id. 같은 판단은 같은 주문이에요 (POL-RISK-07)
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  // 지정가. 시장가는 null
  price: number | null;
  quantity: number;
}

// 주문 요청 결과. unknown은 접수됐는지 알 수 없어서 같은 clientOrderId로 다시 보내거나 조회로 확인해요
export type PlaceResult =
  | { outcome: 'accepted'; brokerOrderId: string }
  | { outcome: 'rejected'; code: string }
  | { outcome: 'unknown'; reason: string };

// 응답 유실 복구에 쓰는 토스 주문 1건
export interface BrokerOrderSummary {
  brokerOrderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number | null;
  orderedAt: Date;
}

const placedSchema = z.object({ orderId: z.string() });
const listSchema = z.object({
  orders: z.array(
    z.object({
      orderId: z.string(),
      symbol: z.string(),
      side: z.enum(['BUY', 'SELL']),
      quantity: z.coerce.number(),
      price: z.coerce.number().nullable().optional(),
      orderedAt: z.coerce.date(),
    }),
  ),
});
const voidSchema = z.unknown();
const stopCreatedSchema = z.object({ conditionalOrderId: z.string() });
const stopDetailSchema = z.object({
  status: z.string(),
  first: z.object({ triggeredOrderId: z.string().nullable().optional() }),
});

// 손절 조건주문 요청 (POL-RISK-11): SINGLE + 시장가 매도
export interface PlaceStop {
  clientOrderId: string;
  symbol: string;
  quantity: number;
  triggerPrice: number;
  // YYYY-MM-DD. 당일 청산 봇은 당일
  expireDate: string;
}

export type StopResult =
  | { outcome: 'accepted'; conditionalOrderId: string }
  | { outcome: 'rejected'; code: string }
  | { outcome: 'unknown'; reason: string };

// 발동돼 주문이 나간 상태 (ConditionalOrderDetailResponse.status)
const TRIGGERED_STATUSES = new Set(['ORDERING', 'ORDERED', 'COMPLETED']);

// 같은 clientOrderId로 다시 보내면 되는 거절 (docs/architecture/order-lifecycle.md 에러별 처리)
const RETRYABLE_CODES = new Set(['request-in-progress']);

// 토스 주문 API (docs/architecture/order-lifecycle.md). 주문·취소 HTTP는 OrderService만 이걸로 보내요.
// ponytail: PaperBroker(M2 5단계)를 붙일 때 같은 모양의 인터페이스로 나눠요
@Injectable()
export class TossBrokerService {
  // 판단용 주문이라 한도를 오래 기다리지 않아요 (NFR-03)
  private static readonly ORDER_WAIT_MS = 1000;
  private static readonly LOOKUP_WAIT_MS = 5000;

  constructor(private readonly toss: TossClient) {}

  async place(order: PlaceOrder): Promise<PlaceResult> {
    try {
      const { orderId } = await this.toss.request({
        group: 'ORDER',
        method: 'POST',
        path: '/api/v1/orders',
        account: true,
        waitMs: TossBrokerService.ORDER_WAIT_MS,
        body: {
          clientOrderId: order.clientOrderId,
          symbol: order.symbol,
          side: order.side,
          orderType: order.orderType,
          timeInForce: 'DAY',
          quantity: String(order.quantity),
          ...(order.price === null ? {} : { price: String(order.price) }),
        },
        result: placedSchema,
      });
      return { outcome: 'accepted', brokerOrderId: orderId };
    } catch (error) {
      return classify(error);
    }
  }

  // 취소 요청이 접수되면 true. 결과(CANCELED)는 personal:order·재동기화로 와요
  async cancel(brokerOrderId: string): Promise<boolean> {
    try {
      await this.toss.request({
        group: 'ORDER',
        method: 'POST',
        path: `/api/v1/orders/${encodeURIComponent(brokerOrderId)}/cancel`,
        account: true,
        body: {},
        waitMs: TossBrokerService.ORDER_WAIT_MS,
        result: voidSchema,
      });
      return true;
    } catch (error) {
      if (error instanceof TossApiError && isClientError(error.status))
        return false;
      throw error;
    }
  }

  async placeStop(stop: PlaceStop): Promise<StopResult> {
    try {
      const { conditionalOrderId } = await this.toss.request({
        group: 'CONDITIONAL_ORDER',
        method: 'POST',
        path: '/api/v1/conditional-orders',
        account: true,
        waitMs: TossBrokerService.ORDER_WAIT_MS,
        body: {
          clientOrderId: stop.clientOrderId,
          symbol: stop.symbol,
          type: 'SINGLE',
          orderType: 'MARKET',
          quantity: String(stop.quantity),
          expireDate: stop.expireDate,
          first: { orderSide: 'SELL', triggerPrice: String(stop.triggerPrice) },
        },
        result: stopCreatedSchema,
      });
      return { outcome: 'accepted', conditionalOrderId };
    } catch (error) {
      const { outcome } = classify(error);
      return outcome === 'rejected' && error instanceof TossApiError
        ? { outcome, code: error.code }
        : { outcome: 'unknown', reason: String(error) };
    }
  }

  // 취소가 받아들여지면 true. 이미 발동·만료돼 취소할 수 없으면 false (상태는 stopState로 확인해요)
  async cancelStop(conditionalOrderId: string): Promise<boolean> {
    try {
      await this.toss.request({
        group: 'CONDITIONAL_ORDER',
        method: 'DELETE',
        path: `/api/v1/conditional-orders/${encodeURIComponent(conditionalOrderId)}`,
        account: true,
        waitMs: TossBrokerService.ORDER_WAIT_MS,
        result: voidSchema,
      });
      return true;
    } catch (error) {
      if (error instanceof TossApiError && isClientError(error.status))
        return false;
      throw error;
    }
  }

  // 손절 조건주문이 발동됐는지와 발동 주문 id
  async stopState(
    conditionalOrderId: string,
  ): Promise<{ isTriggered: boolean; triggeredOrderId: string | null }> {
    const detail = await this.toss.request({
      group: 'CONDITIONAL_ORDER_HISTORY',
      path: `/api/v1/conditional-orders/${encodeURIComponent(conditionalOrderId)}`,
      account: true,
      waitMs: TossBrokerService.LOOKUP_WAIT_MS,
      result: stopDetailSchema,
    });
    return {
      isTriggered: TRIGGERED_STATUSES.has(detail.status),
      triggeredOrderId: detail.first.triggeredOrderId ?? null,
    };
  }

  // 그 날(KST) 이후 접수된 그 종목 주문 (응답 유실 복구 후보 찾기)
  async listOrders(
    symbol: string,
    from: string,
  ): Promise<BrokerOrderSummary[]> {
    const pages = await Promise.all(
      (['OPEN', 'CLOSED'] as const).map((status) =>
        this.toss.request({
          group: 'ORDER_HISTORY',
          path: '/api/v1/orders',
          query: { status, symbol, from },
          account: true,
          waitMs: TossBrokerService.LOOKUP_WAIT_MS,
          result: listSchema,
        }),
      ),
    );
    // ponytail: CLOSED는 첫 페이지(최대 100건)만 봐요. 한 종목에 하루 100건을 넘기면 cursor로 더 읽어요
    return pages.flatMap(({ orders }) =>
      orders.map((order) => ({
        brokerOrderId: order.orderId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.price ?? null,
        orderedAt: order.orderedAt,
      })),
    );
  }
}

function isClientError(status: number): boolean {
  return (
    status >= HttpStatus.BAD_REQUEST &&
    status < HttpStatus.INTERNAL_SERVER_ERROR &&
    status !== HttpStatus.TOO_MANY_REQUESTS
  );
}

// 4xx 거부만 확정 실패예요. 응답 없음·5xx·429·호출 한도·request-in-progress는 접수 여부를 모르는 쪽으로 봐요
function classify(error: unknown): PlaceResult {
  if (
    error instanceof TossApiError &&
    isClientError(error.status) &&
    !RETRYABLE_CODES.has(error.code)
  )
    return { outcome: 'rejected', code: error.code };
  return { outcome: 'unknown', reason: String(error) };
}
