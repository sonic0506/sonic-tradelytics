import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  BrokerOrder,
  OrderEvent,
  OrderModule,
  type OrderReport,
  OrderService,
} from '@/modules/order/index.js';
import { Position } from '@/modules/position/index.js';

import { FakeTossModule } from './setup/fake-toss.js';
import { createTestApp, resetDatabase } from './setup/test-app.js';

// AccountSync가 넘긴 토스 주문을 실제 Postgres에 반영해요 (docs/architecture/order-lifecycle.md 재동기화).
// 제약(origin·decision_id CHECK, 포지션 수량)과 트랜잭션을 실제 DB로 확인해요.
describe('주문 재동기화 반영 (e2e)', () => {
  let app: INestApplication;
  let service: OrderService;
  let dataSource: DataSource;

  const report = (fields: Partial<OrderReport> = {}): OrderReport => ({
    brokerOrderId: 'manual-1',
    symbol: '005930',
    side: 'BUY',
    orderType: 'LIMIT',
    timeInForce: 'DAY',
    status: 'FILLED',
    price: 70_000,
    quantity: 10,
    filledQuantity: 10,
    avgFilledPrice: 70_000,
    filledAmount: 700_000,
    commission: 100,
    tax: 0,
    orderedAt: new Date('2026-10-29T00:30:00Z'),
    canceledAt: null,
    filledAt: new Date('2026-10-29T00:31:00Z'),
    settlementDate: '2026-10-31',
    raw: { orderId: fields.brokerOrderId ?? 'manual-1' },
    ...fields,
  });

  beforeAll(async () => {
    app = await createTestApp([FakeTossModule, OrderModule]);
    service = app.get(OrderService);
    dataSource = app.get(DataSource);
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('모르는 주문은 직접 거래로 넣고, 같은 값을 다시 받아도 한 번만 반영해요', async () => {
    await expect(service.applyReport(report(), 'rest')).resolves.toBe(
      'created',
    );
    await expect(service.applyReport(report(), 'rest')).resolves.toBe(
      'unchanged',
    );

    const order = await dataSource
      .getRepository(BrokerOrder)
      .findOneByOrFail({ brokerOrderId: 'manual-1' });
    expect(order).toMatchObject({
      origin: 'manual',
      decisionId: null,
      status: 'FILLED',
      filledQuantity: 10,
    });
    expect(order.syncedAt).not.toBeNull();
    await expect(
      dataSource.getRepository(OrderEvent).countBy({ orderId: order.id }),
    ).resolves.toBe(1);
    await expect(
      dataSource
        .getRepository(Position)
        .findOneByOrFail({ id: order.positionId }),
    ).resolves.toMatchObject({
      botId: null,
      status: 'open',
      quantity: 10,
      costBasis: 700_000,
      realizedPnl: -100,
      totalFees: 100,
    });
  });

  it('직접 매도가 이어지면 같은 포지션에 붙이고, 다 팔리면 닫아요', async () => {
    await service.applyReport(
      report({
        brokerOrderId: 'manual-2',
        side: 'SELL',
        status: 'PARTIAL_FILLED',
        filledQuantity: 4,
        filledAmount: 300_000,
        commission: 50,
        tax: 500,
        filledAt: null,
      }),
      'ws',
    );
    await service.applyReport(
      report({
        brokerOrderId: 'manual-2',
        side: 'SELL',
        status: 'FILLED',
        filledQuantity: 10,
        filledAmount: 750_000,
        commission: 120,
        tax: 1200,
      }),
      'rest',
    );

    const orders = await dataSource
      .getRepository(BrokerOrder)
      .find({ order: { id: 'ASC' }, take: 10 });
    expect(new Set(orders.map(({ positionId }) => positionId)).size).toBe(1);
    await expect(dataSource.getRepository(OrderEvent).count()).resolves.toBe(3);
    await expect(
      dataSource
        .getRepository(Position)
        .findOneByOrFail({ id: orders[0]?.positionId }),
    ).resolves.toMatchObject({
      status: 'closed',
      exitReason: 'manual',
      quantity: 0,
      costBasis: 0,
      // 매도 750,000 - 매수 700,000 - 수수료·세금(100 + 1,320)
      realizedPnl: 48_580,
      totalFees: 1420,
    });
  });
});
