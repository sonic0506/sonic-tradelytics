import { Test } from '@nestjs/testing';

import type { Position } from '@/modules/position/index.js';

import type { BrokerOrder } from './entities/broker-order.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderQueryService } from './order-query.service.js';

describe('OrderQueryService', () => {
  const orders = {
    findOpenForBots: vi.fn<OrderRepository['findOpenForBots']>(),
    findFilledPage: vi.fn<OrderRepository['findFilledPage']>(),
    findFilledByPositions: vi.fn<OrderRepository['findFilledByPositions']>(),
    findByPosition: vi.fn<OrderRepository['findByPosition']>(),
  };
  let service: OrderQueryService;

  const open = (fields: Partial<BrokerOrder>): BrokerOrder =>
    Object.assign(
      { quantity: 1, filledQuantity: 0, price: null },
      fields,
    ) as BrokerOrder;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrderQueryService,
        { provide: OrderRepository, useValue: orders },
      ],
    }).compile();
    service = moduleRef.get(OrderQueryService);
  });

  it('봇마다 미체결 매수 금액(남은 수량 × 지정가)과 미체결 여부를 모아요', async () => {
    orders.findOpenForBots.mockResolvedValue([
      open({
        side: 'BUY',
        price: 70_000,
        quantity: 10,
        filledQuantity: 4,
        position: Object.assign({ botId: 7 }) as Position,
      }),
      open({
        side: 'SELL',
        price: 71_000,
        quantity: 3,
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

  it('체결 목록은 출처를 정하지 않으면 봇 주문만 보고, 거래일을 KST 하루 구간으로 바꿔요', async () => {
    orders.findFilledPage.mockResolvedValue([[], 0]);

    await service.findFilledPage({
      from: '2026-11-12',
      to: '2026-11-12',
      botIds: ['3'],
      skip: 0,
      size: 5,
    });

    expect(orders.findFilledPage).toHaveBeenCalledWith(
      {
        start: new Date('2026-11-12T00:00:00+09:00'),
        end: new Date('2026-11-13T00:00:00+09:00'),
        botIds: [3],
        origins: ['bot', 'protective'],
      },
      0,
      5,
    );
  });

  it('오늘 체결 수를 매수·매도와 봇마다 세고, 직접 거래는 전체에만 넣어요', async () => {
    const filled = (side: 'BUY' | 'SELL', botId: number | null) =>
      Object.assign({
        side,
        position: Object.assign({ botId }) as Position,
      }) as BrokerOrder;
    orders.findFilledPage.mockResolvedValue([
      [filled('BUY', 7), filled('SELL', 7), filled('BUY', null)],
      3,
    ]);

    const fills = await service.todayFills(
      new Date('2026-11-12T05:00:00+09:00'),
    );

    expect(orders.findFilledPage).toHaveBeenCalledWith(
      { start: new Date('2026-11-12T00:00:00+09:00') },
      0,
      expect.any(Number),
    );
    expect(fills).toEqual({
      total: 3,
      buy: 2,
      sell: 1,
      byBot: new Map([[7, 2]]),
    });
  });

  it('포지션마다 매수·매도 체결 합계와 수수료·세금을 더하고, 체결 금액이 없으면 평균가 × 수량으로 봐요', async () => {
    const filled = (fields: Partial<BrokerOrder>) =>
      Object.assign(
        {
          positionId: 1,
          filledQuantity: 2,
          filledAmount: null,
          avgFilledPrice: 10_000,
          commission: null,
          tax: null,
        },
        fields,
      ) as BrokerOrder;
    orders.findFilledByPositions.mockResolvedValue([
      filled({ side: 'BUY', filledAmount: 20_100, commission: 3 }),
      filled({
        side: 'SELL',
        avgFilledPrice: 10_500.5,
        commission: 3,
        tax: 40,
      }),
    ]);

    const totals = await service.fillTotals([1, 2]);

    expect(totals).toEqual(
      new Map([
        [
          1,
          {
            buyQuantity: 2,
            buyAmount: 20_100,
            sellQuantity: 2,
            sellAmount: 21_001,
            commission: 6,
            tax: 40,
          },
        ],
      ]),
    );
    await expect(service.fillTotals([])).resolves.toEqual(new Map());
    expect(orders.findFilledByPositions).toHaveBeenCalledOnce();
  });

  it('포지션 하나의 주문은 repository 값 그대로 줘요', async () => {
    orders.findByPosition.mockResolvedValue([]);

    await expect(service.findByPosition(3)).resolves.toEqual([]);
    expect(orders.findByPosition).toHaveBeenCalledWith(3);
  });
});
