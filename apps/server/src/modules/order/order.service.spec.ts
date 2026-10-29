import { Test, type TestingModule } from '@nestjs/testing';

import { DecisionService } from '@/modules/decision/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { type Position, PositionService } from '@/modules/position/index.js';
import { RiskService } from '@/modules/risk/index.js';

import {
  noOpTransactionalModule,
  runInCls,
} from '../../../test/setup/transactional.js';
import type { BrokerOrder } from './entities/broker-order.entity.js';
import type { ProtectiveOrder } from './entities/protective-order.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';
import type { OrderReport } from './order.types.js';
import { TossBrokerService } from './toss-broker.service.js';

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
    findRequested: vi.fn<OrderRepository['findRequested']>(),
    linkedBrokerOrderIds: vi.fn<OrderRepository['linkedBrokerOrderIds']>(),
  };
  const decisions = { record: vi.fn<DecisionService['record']>() };
  const broker = {
    place: vi.fn<TossBrokerService['place']>(),
    listOrders: vi.fn<TossBrokerService['listOrders']>(),
  };
  const risk = {
    acquireLock: vi.fn<RiskService['acquireLock']>(),
    releaseLock: vi.fn<RiskService['releaseLock']>(),
    record: vi.fn<RiskService['record']>(),
  };
  let state: EngineStateService;
  const positions = {
    openManual: vi.fn<PositionService['openManual']>(),
    applyFill: vi.fn<PositionService['applyFill']>(),
    openForBot: vi.fn<PositionService['openForBot']>(),
    closeNotFilled: vi.fn<PositionService['closeNotFilled']>(),
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
        { provide: DecisionService, useValue: decisions },
        { provide: TossBrokerService, useValue: broker },
        { provide: RiskService, useValue: risk },
        EngineStateService,
      ],
    }).compile();
    service = moduleRef.get(OrderService);
    state = moduleRef.get(EngineStateService);
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

  describe('진입 주문', () => {
    const request = {
      botId: 7,
      botVersionId: 70,
      symbol: '005930',
      price: 70_000,
      quantity: 3,
      rationale: {
        passed: [],
        failed: [],
        score: null,
        direction: 'up' as const,
        targetPrice: 73_000,
        stopPrice: 68_000,
        horizonMinutes: 60,
      },
    };
    const saved = () =>
      known({
        id: 30,
        positionId: 2,
        decisionId: 'd-1',
        symbol: '005930',
        side: 'BUY',
        orderType: 'LIMIT',
        price: 70_000,
        quantity: 3,
      });
    const enter = () => runInCls(moduleRef, () => service.enter(request));

    beforeEach(() => {
      risk.acquireLock.mockResolvedValue(true);
      positions.openForBot.mockResolvedValue(
        Object.assign({ id: 2 }) as Awaited<
          ReturnType<PositionService['openForBot']>
        >,
      );
      decisions.record.mockResolvedValue('d-1');
      orders.create.mockResolvedValue(saved());
      positions.closeNotFilled.mockResolvedValue(true);
    });

    it('포지션·판단·주문을 저장한 뒤 판단 id를 clientOrderId로 보내고 접수되면 PENDING이에요', async () => {
      broker.place.mockResolvedValue({
        outcome: 'accepted',
        brokerOrderId: 'o-9',
      });

      await expect(enter()).resolves.toEqual({
        status: 'accepted',
        brokerOrderId: 'o-9',
      });

      expect(decisions.record).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'enter',
          positionId: 2,
          skipReason: null,
        }),
      );
      expect(orders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'bot',
          decisionId: 'd-1',
          status: 'requested',
          side: 'BUY',
        }),
      );
      expect(broker.place).toHaveBeenCalledWith(
        expect.objectContaining({
          clientOrderId: 'd-1',
          quantity: 3,
          price: 70_000,
        }),
      );
      expect(orders.update).toHaveBeenCalledWith(30, {
        brokerOrderId: 'o-9',
        status: 'PENDING',
        orderedAt: now,
      });
    });

    it('정지 중인 봇은 잠금도 저장도 하지 않아요', async () => {
      state.blockBot(7, 'pause');

      await expect(enter()).resolves.toEqual({ status: 'blocked' });
      expect(risk.acquireLock).not.toHaveBeenCalled();
      expect(orders.create).not.toHaveBeenCalled();
    });

    it('다른 봇이 종목을 잡고 있으면 건너뛴 판단(symbol_lock)만 남겨요', async () => {
      risk.acquireLock.mockResolvedValue(false);

      await expect(enter()).resolves.toEqual({
        status: 'skipped',
        reason: 'symbol_lock',
      });
      expect(decisions.record).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'skip',
          skipReason: 'symbol_lock',
          positionId: null,
        }),
      );
      expect(orders.create).not.toHaveBeenCalled();
    });

    it('저장하는 사이 킬 스위치가 들어오면 보내지 않고 실패로 정리해요', async () => {
      orders.create.mockImplementation(() => {
        state.halt('kill');
        return Promise.resolve(saved());
      });

      await expect(enter()).resolves.toEqual({ status: 'blocked' });
      expect(broker.place).not.toHaveBeenCalled();
      expect(orders.update).toHaveBeenCalledWith(30, {
        status: 'request_failed',
        rejectCode: 'not_sent',
      });
      expect(risk.releaseLock).toHaveBeenCalledWith('005930', 7);
    });

    it('거부되면 request_failed로 남기고 체결 없는 포지션을 닫고 잠금을 풀어요', async () => {
      broker.place.mockResolvedValue({
        outcome: 'rejected',
        code: 'insufficient-buying-power',
      });

      await expect(enter()).resolves.toEqual({
        status: 'rejected',
        code: 'insufficient-buying-power',
      });
      expect(positions.closeNotFilled).toHaveBeenCalledWith(2, now);
      expect(risk.releaseLock).toHaveBeenCalledWith('005930', 7);
      expect(risk.record).not.toHaveBeenCalled();
    });

    it('분할 매수 중이라 포지션이 닫히지 않으면 잠금을 풀지 않아요', async () => {
      broker.place.mockResolvedValue({
        outcome: 'rejected',
        code: 'price-out-of-range',
      });
      positions.closeNotFilled.mockResolvedValue(false);

      await enter();

      expect(risk.releaseLock).not.toHaveBeenCalled();
    });

    it('같은 id로 다른 내용을 보낸 코드 버그면 그 봇을 멈추고 알려요', async () => {
      broker.place.mockResolvedValue({
        outcome: 'rejected',
        code: 'idempotency-key-conflict',
      });

      await enter();

      expect(state.canEnter(7)).toBe(false);
      expect(risk.record).toHaveBeenCalledWith(
        'order_rejected',
        7,
        expect.objectContaining({ code: 'idempotency-key-conflict' }),
      );
    });

    it('응답을 못 받으면 requested로 두고 나중에 확인해요', async () => {
      broker.place.mockResolvedValue({ outcome: 'unknown', reason: 'timeout' });

      await expect(enter()).resolves.toEqual({ status: 'pending' });
      expect(orders.update).not.toHaveBeenCalled();
    });
  });

  describe('응답 유실 복구', () => {
    const lost = (createdAt: Date) =>
      known({
        id: 40,
        positionId: 2,
        decisionId: 'd-2',
        symbol: '005930',
        side: 'BUY',
        orderType: 'LIMIT',
        price: 70_000,
        quantity: 3,
        status: 'requested',
        createdAt,
        position: Object.assign({ botId: 7 }) as Position,
      });
    const candidate = (brokerOrderId: string, fields = {}) => ({
      brokerOrderId,
      symbol: '005930',
      side: 'BUY' as const,
      quantity: 3,
      price: 70_000,
      orderedAt: new Date('2026-10-29T00:30:00Z'),
      ...fields,
    });
    const recover = () => runInCls(moduleRef, () => service.recoverRequested());

    beforeEach(() => {
      orders.linkedBrokerOrderIds.mockResolvedValue(new Set());
      positions.closeNotFilled.mockResolvedValue(true);
    });

    it('보낸 지 10분 안이면 같은 clientOrderId로 다시 보내요', async () => {
      orders.findRequested.mockResolvedValue([
        lost(new Date('2026-10-29T00:55:00Z')),
      ]);
      broker.place.mockResolvedValue({
        outcome: 'accepted',
        brokerOrderId: 'o-1',
      });

      await recover();

      expect(broker.place).toHaveBeenCalledWith(
        expect.objectContaining({ clientOrderId: 'd-2' }),
      );
      expect(broker.listOrders).not.toHaveBeenCalled();
    });

    it('10분이 지나면 다시 보내지 않고, 연결되지 않은 같은 주문이 1건이면 연결해요', async () => {
      orders.findRequested.mockResolvedValue([
        lost(new Date('2026-10-29T00:20:00Z')),
      ]);
      broker.listOrders.mockResolvedValue([
        candidate('o-1'),
        candidate('o-2', { quantity: 5 }),
        candidate('o-3'),
      ]);
      orders.linkedBrokerOrderIds.mockResolvedValue(new Set(['o-3']));

      await recover();

      expect(broker.place).not.toHaveBeenCalled();
      expect(broker.listOrders).toHaveBeenCalledWith('005930', '2026-10-29');
      expect(orders.update).toHaveBeenCalledWith(40, {
        brokerOrderId: 'o-1',
        status: 'PENDING',
        orderedAt: new Date('2026-10-29T00:30:00Z'),
      });
    });

    it('후보가 없으면 접수되지 않은 것으로 보고 not_found로 정리해요', async () => {
      orders.findRequested.mockResolvedValue([
        lost(new Date('2026-10-29T00:20:00Z')),
      ]);
      broker.listOrders.mockResolvedValue([]);

      await recover();

      expect(orders.update).toHaveBeenCalledWith(40, {
        status: 'request_failed',
        rejectCode: 'not_found',
      });
      expect(risk.releaseLock).toHaveBeenCalledWith('005930', 7);
    });

    it('후보가 2건 이상이면 고르지 않고 그 봇을 멈추고 알려요', async () => {
      orders.findRequested.mockResolvedValue([
        lost(new Date('2026-10-29T00:20:00Z')),
      ]);
      broker.listOrders.mockResolvedValue([candidate('o-1'), candidate('o-2')]);

      await recover();

      expect(orders.update).not.toHaveBeenCalled();
      expect(state.canEnter(7)).toBe(false);
      expect(risk.record).toHaveBeenCalledWith(
        'order_rejected',
        7,
        expect.objectContaining({
          reason: 'ambiguous_recovery',
          candidates: ['o-1', 'o-2'],
        }),
      );
    });
  });
});
