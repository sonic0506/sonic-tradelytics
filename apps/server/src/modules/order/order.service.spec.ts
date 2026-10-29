import { Test, type TestingModule } from '@nestjs/testing';

import { type Position, PositionService } from '@/modules/position/index.js';

import {
  noOpTransactionalModule,
  runInCls,
} from '../../../test/setup/transactional.js';
import type { BrokerOrder } from './entities/broker-order.entity.js';
import type { ProtectiveOrder } from './entities/protective-order.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';
import type { OrderReport } from './order.types.js';

describe('OrderService', () => {
  const orders = {
    findByBrokerOrderId: vi.fn<OrderRepository['findByBrokerOrderId']>(),
    findProtectiveByTriggeredOrderId:
      vi.fn<OrderRepository['findProtectiveByTriggeredOrderId']>(),
    hasLostCandidate: vi.fn<OrderRepository['hasLostCandidate']>(),
    create: vi.fn<OrderRepository['create']>(),
    update: vi.fn<OrderRepository['update']>(),
    addEvent: vi.fn<OrderRepository['addEvent']>(),
    findOpenForBots: vi.fn<OrderRepository['findOpenForBots']>(),
  };
  const positions = {
    openManual: vi.fn<PositionService['openManual']>(),
    applyFill: vi.fn<PositionService['applyFill']>(),
  };
  let moduleRef: TestingModule;
  let service: OrderService;
  const now = new Date('2026-10-29T01:00:00Z');
  const orderedAt = new Date('2026-10-29T00:30:00Z');
  const filledAt = new Date('2026-10-29T00:31:00Z');

  const report = (fields: Partial<OrderReport> = {}): OrderReport => ({
    brokerOrderId: 'o-1',
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
    orderedAt,
    canceledAt: null,
    filledAt,
    settlementDate: '2026-10-31',
    raw: { orderId: 'o-1' },
    ...fields,
  });
  const known = (fields: Partial<BrokerOrder> = {}): BrokerOrder =>
    Object.assign(
      {
        id: 5,
        positionId: 2,
        status: 'PENDING',
        filledQuantity: 0,
        filledAmount: null,
        commission: null,
        tax: null,
        filledAt: null,
        syncedAt: null,
      },
      fields,
    ) as BrokerOrder;
  const apply = (value: OrderReport, source: 'ws' | 'rest' = 'ws') =>
    runInCls(moduleRef, () => service.applyReport(value, source));

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now, toFake: ['Date'] });
    moduleRef = await Test.createTestingModule({
      imports: [noOpTransactionalModule],
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: orders },
        { provide: PositionService, useValue: positions },
      ],
    }).compile();
    service = moduleRef.get(OrderService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('봇마다 미체결 매수 금액(남은 수량 × 지정가)과 미체결 여부를 모아요', async () => {
    orders.findOpenForBots.mockResolvedValue([
      known({
        side: 'BUY',
        price: 70_000,
        quantity: 10,
        filledQuantity: 4,
        position: Object.assign({ botId: 7 }) as Position,
      }),
      known({
        side: 'SELL',
        price: 71_000,
        quantity: 3,
        filledQuantity: 0,
        position: Object.assign({ botId: 8 }) as Position,
      }),
    ]);

    const result = await service.openOrdersByBot([7, 8, 9]);

    expect(result.get(7)).toEqual({
      openBuyAmount: 420_000,
      hasOpenOrders: true,
    });
    expect(result.get(8)).toEqual({ openBuyAmount: 0, hasOpenOrders: true });
    expect(result.get(9)).toEqual({ openBuyAmount: 0, hasOpenOrders: false });
  });

  it('봇이 없으면 미체결을 조회하지 않아요', async () => {
    await expect(service.openOrdersByBot([])).resolves.toEqual(new Map());
    expect(orders.findOpenForBots).not.toHaveBeenCalled();
  });

  it('아는 주문의 체결이 늘면 상태를 갱신하고 늘어난 만큼만 포지션에 반영해요', async () => {
    orders.findByBrokerOrderId.mockResolvedValue(
      known({
        status: 'PARTIAL_FILLED',
        filledQuantity: 4,
        filledAmount: 280_000,
        commission: 40,
        tax: 0,
      }),
    );

    await expect(apply(report())).resolves.toBe('updated');

    expect(orders.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ status: 'FILLED', filledQuantity: 10 }),
    );
    expect(orders.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 5,
        source: 'ws',
        status: 'FILLED',
        filledQuantityDelta: 6,
        fillPrice: 70_000,
      }),
    );
    expect(positions.applyFill).toHaveBeenCalledWith(2, {
      side: 'BUY',
      quantity: 6,
      amount: 420_000,
      fees: 60,
      at: filledAt,
    });
  });

  it('체결 없이 상태만 바뀌면 이력만 남기고 포지션은 그대로예요', async () => {
    orders.findByBrokerOrderId.mockResolvedValue(known());

    await apply(
      report({
        status: 'CANCELED',
        filledQuantity: 0,
        filledAmount: null,
        commission: null,
        tax: null,
      }),
    );

    expect(orders.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CANCELED', filledQuantityDelta: 0 }),
    );
    expect(positions.applyFill).not.toHaveBeenCalled();
  });

  it('웹소켓 이벤트에 체결 시각이 없으면 저장된 체결 시각을 지우지 않아요', async () => {
    const savedFilledAt = new Date('2026-10-29T00:30:30Z');
    orders.findByBrokerOrderId.mockResolvedValue(
      known({
        status: 'PARTIAL_FILLED',
        filledQuantity: 4,
        filledAt: savedFilledAt,
      }),
    );

    await apply(report({ filledAt: null }));

    expect(orders.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ filledAt: savedFilledAt }),
    );
  });

  it('REST 값이 같으면 맞춘 시각만 갱신하고 이력은 남기지 않아요', async () => {
    orders.findByBrokerOrderId.mockResolvedValue(
      known({ status: 'FILLED', filledQuantity: 10 }),
    );

    await expect(apply(report(), 'rest')).resolves.toBe('unchanged');

    expect(orders.update).toHaveBeenCalledWith(5, { syncedAt: now });
    expect(orders.addEvent).not.toHaveBeenCalled();
  });

  it('늦게 온 옛 값은 반영하지 않아요', async () => {
    orders.findByBrokerOrderId.mockResolvedValue(
      known({ status: 'FILLED', filledQuantity: 10 }),
    );

    await expect(
      apply(report({ status: 'PARTIAL_FILLED', filledQuantity: 4 })),
    ).resolves.toBe('unchanged');
    await expect(
      apply(report({ status: 'PENDING', filledQuantity: 10 })),
    ).resolves.toBe('unchanged');

    expect(orders.update).not.toHaveBeenCalled();
    expect(positions.applyFill).not.toHaveBeenCalled();
  });

  it('취소 거부 레코드는 따로 반영하지 않아요', async () => {
    await expect(apply(report({ status: 'CANCEL_REJECTED' }))).resolves.toBe(
      'ignored',
    );

    expect(orders.findByBrokerOrderId).not.toHaveBeenCalled();
  });

  it('모르는 주문이 손절 발동 주문이면 그 포지션에 protective로 넣어요', async () => {
    orders.findByBrokerOrderId.mockResolvedValue(null);
    orders.findProtectiveByTriggeredOrderId.mockResolvedValue(
      Object.assign({ positionId: 8 }) as ProtectiveOrder,
    );
    orders.create.mockResolvedValue(known({ id: 11, positionId: 8 }));

    await expect(apply(report({ side: 'SELL' }))).resolves.toBe('created');

    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'protective', positionId: 8 }),
    );
    expect(positions.openManual).not.toHaveBeenCalled();
    expect(positions.applyFill).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ side: 'SELL', quantity: 10 }),
    );
  });

  it('응답을 못 받은 봇 주문일 수 있으면 직접 거래로 분류하지 않고 둬요', async () => {
    orders.findByBrokerOrderId.mockResolvedValue(null);
    orders.findProtectiveByTriggeredOrderId.mockResolvedValue(null);
    orders.hasLostCandidate.mockResolvedValue(true);

    await expect(apply(report())).resolves.toBe('pending_recovery');

    expect(orders.create).not.toHaveBeenCalled();
    expect(positions.applyFill).not.toHaveBeenCalled();
  });

  it('나머지 모르는 주문은 직접 거래 포지션에 manual로 넣고 체결 전체를 반영해요', async () => {
    orders.findByBrokerOrderId.mockResolvedValue(null);
    orders.findProtectiveByTriggeredOrderId.mockResolvedValue(null);
    orders.hasLostCandidate.mockResolvedValue(false);
    positions.openManual.mockResolvedValue(
      Object.assign({ id: 3 }) as Awaited<
        ReturnType<PositionService['openManual']>
      >,
    );
    orders.create.mockResolvedValue(known({ id: 12, positionId: 3 }));

    await expect(apply(report(), 'rest')).resolves.toBe('created');

    expect(positions.openManual).toHaveBeenCalledWith('005930', orderedAt);
    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'manual',
        decisionId: null,
        positionId: 3,
        brokerOrderId: 'o-1',
        filledQuantity: 10,
        syncedAt: now,
      }),
    );
    expect(positions.applyFill).toHaveBeenCalledWith(3, {
      side: 'BUY',
      quantity: 10,
      amount: 700_000,
      fees: 100,
      at: filledAt,
    });
  });
});
