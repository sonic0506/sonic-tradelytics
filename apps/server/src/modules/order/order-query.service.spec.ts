import { Test } from '@nestjs/testing';

import type { Position } from '@/modules/position/index.js';

import type { BrokerOrder } from './entities/broker-order.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderQueryService } from './order-query.service.js';

describe('OrderQueryService', () => {
  const orders = {
    findOpenForBots: vi.fn<OrderRepository['findOpenForBots']>(),
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
});
