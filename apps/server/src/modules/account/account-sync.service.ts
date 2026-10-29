import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';
import { type OrderReport, OrderService } from '@/modules/order/index.js';

const decimal = z.coerce.number();
// bigint 컬럼에 넣는 원화 금액
const won = z.coerce.number().transform(Math.round);
const date = z.coerce.date();

// 토스 주문 1건 (REST 주문 조회와 personal:order의 order가 같은 모양이에요. 웹소켓에는 filledAt만 없어요)
const tossOrderSchema = z.object({
  orderId: z.string(),
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  orderType: z.enum(['LIMIT', 'MARKET']),
  timeInForce: z.enum(['DAY', 'CLS', 'OPG']),
  status: z.string(),
  price: won.nullable().optional(),
  quantity: decimal,
  currency: z.string(),
  orderedAt: date,
  canceledAt: date.nullable().optional(),
  execution: z.object({
    filledQuantity: decimal,
    averageFilledPrice: decimal.nullable().optional(),
    filledAmount: won.nullable().optional(),
    commission: won.nullable().optional(),
    tax: won.nullable().optional(),
    filledAt: date.nullable().optional(),
    settlementDate: z.string().nullable().optional(),
  }),
});
const rawSchema = z.record(z.string(), z.unknown());
const pageSchema = z.object({
  orders: z.array(rawSchema),
  nextCursor: z.string().nullable(),
  hasNext: z.boolean(),
});
// personal:order 프레임의 data. event 이름은 OrderStatus와 달라서(PARTIAL_FILL 등) 상태는 order.status를 써요
const orderEventSchema = z.object({ event: z.string(), order: rawSchema });

// 토스 주문과 broker_orders를 맞춰요 (docs/architecture/order-lifecycle.md 재동기화).
// 웹소켓 이벤트와 REST 조회를 한 줄로 세워 차례로 반영해요. 같은 주문을 동시에 고치지 않게 하기 위해서예요.
@Injectable()
export class AccountSyncService {
  // 장중 OPEN 재동기화 주기
  private static readonly SYNC_MS = 30_000;
  // CLOSED 한 페이지 최대
  private static readonly PAGE_SIZE = 100;
  // 재동기화는 판단용이 아니라 한도를 기다려도 돼요
  private static readonly WAIT_MS = 5000;
  private static readonly TIME_ZONE = 'Asia/Seoul';

  private readonly logger = new Logger(AccountSyncService.name);
  private queue: Promise<unknown> = Promise.resolve();
  private timer: NodeJS.Timeout | undefined;
  private isSyncing = false;

  constructor(
    private readonly toss: TossClient,
    private readonly orders: OrderService,
  ) {}

  // ponytail: 장 캘린더가 없어서 장 밖에도 30초마다 OPEN을 조회해요. 캘린더를 만들면 장중에만 돌려요
  start(): void {
    this.timer = setInterval(() => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      this.enqueue(() => this.syncOpen())
        .catch((error: unknown) => {
          this.logger.warn(`주문 재동기화 실패: ${String(error)}`);
        })
        .finally(() => {
          this.isSyncing = false;
        });
    }, AccountSyncService.SYNC_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  // engine 시작, 웹소켓 재연결 직후: OPEN 전량 + 오늘 CLOSED. 실패하면 던져요(시작 순서 6번은 실패 시 종료)
  syncAll(): Promise<void> {
    return this.enqueue(async () => {
      await this.syncOpen();
      await this.syncClosedToday();
    });
  }

  // 재연결 뒤. 끊긴 동안의 personal:order는 다시 오지 않아요
  resync(): void {
    this.syncAll().catch((error: unknown) => {
      this.logger.error(`재연결 뒤 재동기화 실패: ${String(error)}`);
    });
  }

  // personal:order 프레임. 웹소켓 수신을 막지 않게 줄에 넣기만 해요
  receive(data: unknown): void {
    const parsed = orderEventSchema.safeParse(data);
    if (!parsed.success) {
      this.logger.warn('모양이 다른 personal:order 프레임');
      return;
    }
    this.enqueue(() => this.apply(parsed.data.order, 'ws')).catch(
      (error: unknown) => {
        this.logger.error(
          `주문 이벤트 반영 실패(${parsed.data.event}): ${String(error)}. 다음 재동기화가 고쳐요`,
        );
      },
    );
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async syncOpen(): Promise<void> {
    const page = await this.fetch({ status: 'OPEN' });
    await this.applyAll(page.orders);
  }

  // 오늘 CLOSED를 cursor로 끝까지 읽어요
  private async syncClosedToday(cursor?: string): Promise<void> {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: AccountSyncService.TIME_ZONE,
    }).format(new Date());
    const page = await this.fetch({
      status: 'CLOSED',
      from: today,
      to: today,
      limit: AccountSyncService.PAGE_SIZE,
      cursor,
    });
    await this.applyAll(page.orders);
    if (page.hasNext && page.nextCursor)
      await this.syncClosedToday(page.nextCursor);
  }

  // 같은 직접 거래 포지션을 동시에 고치지 않게 한 건씩 차례로 반영해요
  private applyAll(raws: Record<string, unknown>[]): Promise<void> {
    return raws.reduce<Promise<void>>(
      (previous, raw) => previous.then(() => this.apply(raw, 'rest')),
      Promise.resolve(),
    );
  }

  private fetch(
    query: Record<string, string | number | undefined>,
  ): Promise<z.infer<typeof pageSchema>> {
    return this.toss.request({
      group: 'ORDER_HISTORY',
      path: '/api/v1/orders',
      query,
      account: true,
      waitMs: AccountSyncService.WAIT_MS,
      result: pageSchema,
    });
  }

  private async apply(
    raw: Record<string, unknown>,
    source: 'ws' | 'rest',
  ): Promise<void> {
    const parsed = tossOrderSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn(`모양이 다른 토스 주문: ${JSON.stringify(raw.orderId)}`);
      return;
    }
    // 국내 주식만 다뤄요
    if (parsed.data.currency !== 'KRW') return;
    await this.orders.applyReport(toReport(parsed.data, raw), source);
  }
}

function toReport(
  order: z.infer<typeof tossOrderSchema>,
  raw: Record<string, unknown>,
): OrderReport {
  const { execution } = order;
  return {
    brokerOrderId: order.orderId,
    symbol: order.symbol,
    side: order.side,
    orderType: order.orderType,
    timeInForce: order.timeInForce,
    status: order.status,
    price: order.price ?? null,
    quantity: order.quantity,
    filledQuantity: execution.filledQuantity,
    avgFilledPrice: execution.averageFilledPrice ?? null,
    filledAmount: execution.filledAmount ?? null,
    commission: execution.commission ?? null,
    tax: execution.tax ?? null,
    orderedAt: order.orderedAt,
    canceledAt: order.canceledAt ?? null,
    filledAt: execution.filledAt ?? null,
    settlementDate: execution.settlementDate ?? null,
    raw,
  };
}
