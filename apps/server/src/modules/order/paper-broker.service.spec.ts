import { Test } from '@nestjs/testing';

import {
  MarketCalendarService,
  MarketCollectorService,
  type MarketSnapshot,
} from '@/modules/market-data/index.js';

import type { BrokerOrder } from './entities/broker-order.entity.js';
import type { FeeSchedule } from './entities/fee-schedule.entity.js';
import type { ProtectiveOrder } from './entities/protective-order.entity.js';
import { OrderRepository } from './order.repository.js';
import type { OrderReport } from './order.types.js';
import { PaperBrokerService } from './paper-broker.service.js';

describe('PaperBrokerService', () => {
  const orders = {
    findFeeSchedule: vi.fn<OrderRepository['findFeeSchedule']>(),
    findOpenBotOrders: vi.fn<OrderRepository['findOpenBotOrders']>(),
    findWatchingProtectives:
      vi.fn<OrderRepository['findWatchingProtectives']>(),
  };
  const market = { snapshot: vi.fn<MarketCollectorService['snapshot']>() };
  const calendar = {
    isRegularSession: vi.fn<MarketCalendarService['isRegularSession']>(),
  };
  const onReport = vi.fn<(report: OrderReport) => Promise<unknown>>();
  let broker: PaperBrokerService;

  // 2026-10-30(금) 10:00 KST
  const now = new Date('2026-10-30T01:00:00Z');
  const rates: FeeSchedule = {
    id: 1,
    effectiveFrom: '2026-01-01',
    commissionRate: 0.00015,
    taxRate: 0.002,
    createdAt: now,
  };
  const snapshot = (price: number): MarketSnapshot => ({
    price,
    asks: [{ price: price + 100, volume: 10 }],
    bids: [{ price, volume: 10 }],
    receivedAt: now.getTime(),
  });
  const buy = {
    clientOrderId: 'd-1',
    symbol: '005930',
    side: 'BUY' as const,
    orderType: 'LIMIT' as const,
    price: 70_000,
    quantity: 3,
  };
  const reports = () => onReport.mock.calls.map(([report]) => report);

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now });
    orders.findFeeSchedule.mockResolvedValue(rates);
    orders.findOpenBotOrders.mockResolvedValue([]);
    orders.findWatchingProtectives.mockResolvedValue([]);
    calendar.isRegularSession.mockReturnValue(true);
    onReport.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaperBrokerService,
        { provide: OrderRepository, useValue: orders },
        { provide: MarketCollectorService, useValue: market },
        { provide: MarketCalendarService, useValue: calendar },
      ],
    }).compile();
    broker = moduleRef.get(PaperBrokerService);
  });

  afterEach(() => {
    broker.stop();
    vi.useRealTimers();
  });

  it('수수료율이 없으면 시작하지 않아요', async () => {
    orders.findFeeSchedule.mockResolvedValue(null);

    await expect(broker.start(onReport)).rejects.toThrow(
      '2026-10-30에 적용할 fee_schedules 수수료율이 없어요.',
    );
  });

  it('지정가에 닿으면 체결하고 수수료를 넣어 1초 안에 결과를 넘겨요', async () => {
    await broker.start(onReport);
    await expect(broker.place(buy)).resolves.toEqual({
      outcome: 'accepted',
      brokerOrderId: 'paper-d-1',
    });
    market.snapshot.mockReturnValue(snapshot(69_800));

    await vi.advanceTimersByTimeAsync(1000);

    expect(reports()).toEqual([
      expect.objectContaining({
        brokerOrderId: 'paper-d-1',
        status: 'FILLED',
        filledQuantity: 3,
        avgFilledPrice: 69_900,
        filledAmount: 209_700,
        commission: 31,
        tax: 0,
        filledAt: new Date(now.getTime() + 1000),
      }),
    ]);
  });

  it('같은 판단은 같은 주문이고, 같은 종목 반대 방향 미체결이 있으면 거부해요', async () => {
    await broker.start(onReport);
    await broker.place(buy);

    await expect(broker.place(buy)).resolves.toEqual({
      outcome: 'accepted',
      brokerOrderId: 'paper-d-1',
    });
    await expect(
      broker.place({ ...buy, clientOrderId: 'd-2', side: 'SELL' }),
    ).resolves.toEqual({
      outcome: 'rejected',
      code: 'opposite-pending-order-exists',
    });
  });

  it('취소한 주문은 다음 주기에 CANCELED로 넘기고 다시 취소하면 false예요', async () => {
    await broker.start(onReport);
    await broker.place(buy);

    await expect(broker.cancel('paper-d-1')).resolves.toBe(true);
    await expect(broker.cancel('paper-d-1')).resolves.toBe(false);
    expect(onReport).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(reports()).toEqual([
      expect.objectContaining({ status: 'CANCELED', canceledAt: now }),
    ]);
  });

  it('손절은 발동가 이하에서 시장가 매도를 내고 발동 주문 id를 알려 줘요', async () => {
    await broker.start(onReport);
    await broker.placeStop({
      clientOrderId: 's-1',
      symbol: '005930',
      quantity: 3,
      triggerPrice: 68_000,
      expireDate: '2026-10-30',
    });
    market.snapshot.mockReturnValue(snapshot(67_900));

    await vi.advanceTimersByTimeAsync(1000);

    await expect(broker.stopState('paper-stop-s-1')).resolves.toEqual({
      isTriggered: true,
      triggeredOrderId: 'paper-trigger-paper-stop-s-1',
    });
    await expect(broker.cancelStop('paper-stop-s-1')).resolves.toBe(false);
    // 시장가 매도: 매수 1호가 67,900에서 1틱(100) 낮게
    expect(reports()).toEqual([
      expect.objectContaining({
        side: 'SELL',
        orderType: 'MARKET',
        avgFilledPrice: 67_800,
        commission: 30,
        tax: 406,
      }),
    ]);
  });

  it('정규장이 아니면 체결하지 않고, 정규장이 끝나면 미체결을 취소해요', async () => {
    await broker.start(onReport);
    await broker.place(buy);
    market.snapshot.mockReturnValue(snapshot(60_000));
    calendar.isRegularSession.mockReturnValue(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onReport).not.toHaveBeenCalled();

    calendar.isRegularSession.mockReturnValueOnce(true);
    market.snapshot.mockReturnValue(undefined);
    await vi.advanceTimersByTimeAsync(2000);

    expect(reports()).toEqual([
      expect.objectContaining({ status: 'CANCELED' }),
    ]);
  });

  it('결과를 넘기다 실패하면 다음 주기에 다시 넘겨요', async () => {
    await broker.start(onReport);
    await broker.place(buy);
    await broker.cancel('paper-d-1');
    onReport.mockRejectedValueOnce(new Error('db down'));

    await vi.advanceTimersByTimeAsync(2000);

    expect(reports().map(({ status }) => status)).toEqual([
      'CANCELED',
      'CANCELED',
    ]);
  });

  it('재시작하면 오늘 미체결과 손절을 다시 맡고 지난 날 미체결은 취소해요', async () => {
    orders.findOpenBotOrders.mockResolvedValue([
      Object.assign({
        brokerOrderId: 'paper-today',
        symbol: '005930',
        side: 'BUY',
        orderType: 'LIMIT',
        price: 70_000,
        quantity: 3,
        filledQuantity: 0,
        createdAt: now,
      }) as BrokerOrder,
      Object.assign({
        brokerOrderId: 'paper-yesterday',
        symbol: '000660',
        side: 'BUY',
        orderType: 'LIMIT',
        price: 100_000,
        quantity: 1,
        filledQuantity: 0,
        createdAt: new Date('2026-10-29T01:00:00Z'),
      }) as BrokerOrder,
    ]);
    orders.findWatchingProtectives.mockResolvedValue([
      Object.assign({
        brokerConditionalOrderId: 'paper-stop-old',
        position: { symbol: '005930' },
        quantity: 3,
        triggerPrice: 68_000,
        expireDate: '2026-10-30',
      }) as ProtectiveOrder,
    ]);

    await broker.start(onReport);

    await expect(broker.listOrders('005930', '2026-10-30')).resolves.toEqual([
      expect.objectContaining({ brokerOrderId: 'paper-today' }),
    ]);
    await expect(broker.cancelStop('paper-stop-old')).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(reports()).toEqual([
      expect.objectContaining({
        brokerOrderId: 'paper-yesterday',
        status: 'CANCELED',
      }),
    ]);
  });
});
