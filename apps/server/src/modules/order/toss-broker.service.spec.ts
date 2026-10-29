import { Test } from '@nestjs/testing';
import type { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';
import { TossApiError, TossNoResponseError } from '@/infra/toss/toss.errors.js';

import { TossBrokerService } from './toss-broker.service.js';

describe('TossBrokerService', () => {
  const toss = {
    request:
      vi.fn<
        (options: {
          result: z.ZodType;
          body?: unknown;
          query?: unknown;
        }) => Promise<unknown>
      >(),
  };
  let broker: TossBrokerService;
  const order = {
    clientOrderId: 'd-1',
    symbol: '005930',
    side: 'BUY' as const,
    orderType: 'LIMIT' as const,
    price: 70_000,
    quantity: 3,
  };
  // TossClient처럼 응답 result를 넘겨받은 스키마로 검증해요
  const respond = (raw: unknown): void => {
    toss.request.mockImplementation(({ result }) =>
      Promise.resolve(result.parse(raw)),
    );
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [TossBrokerService, { provide: TossClient, useValue: toss }],
    }).compile();
    broker = moduleRef.get(TossBrokerService);
  });

  it('지정가 주문을 문자열 숫자로 보내고 orderId를 받아요', async () => {
    respond({ orderId: 'o-1', clientOrderId: 'd-1' });

    await expect(broker.place(order)).resolves.toEqual({
      outcome: 'accepted',
      brokerOrderId: 'o-1',
    });
    expect(toss.request).toHaveBeenCalledWith(
      expect.objectContaining({
        group: 'ORDER',
        method: 'POST',
        path: '/api/v1/orders',
        account: true,
        body: {
          clientOrderId: 'd-1',
          symbol: '005930',
          side: 'BUY',
          orderType: 'LIMIT',
          timeInForce: 'DAY',
          quantity: '3',
          price: '70000',
        },
      }),
    );
  });

  it('시장가는 가격을 보내지 않아요', async () => {
    respond({ orderId: 'o-2' });

    await broker.place({ ...order, orderType: 'MARKET', price: null });

    const [options] = toss.request.mock.lastCall ?? [];
    expect(options?.body).not.toHaveProperty('price');
  });

  it('4xx 거부는 확정 실패예요', async () => {
    toss.request.mockRejectedValue(
      new TossApiError(422, 'insufficient-buying-power', '잔고 부족'),
    );

    await expect(broker.place(order)).resolves.toEqual({
      outcome: 'rejected',
      code: 'insufficient-buying-power',
    });
  });

  it.each([
    ['응답 없음', new TossNoResponseError('/api/v1/orders', 'timeout')],
    [
      '처리 중(409 request-in-progress)',
      new TossApiError(409, 'request-in-progress', ''),
    ],
    ['호출 한도(429)', new TossApiError(429, 'rate-limited', '')],
    ['서버 오류(5xx)', new TossApiError(503, 'unavailable', '')],
  ])('%s면 접수 여부를 모르는 것으로 봐요', async (_, error) => {
    toss.request.mockRejectedValue(error);

    await expect(broker.place(order)).resolves.toMatchObject({
      outcome: 'unknown',
    });
  });

  it('취소가 접수되면 true, 4xx로 거부되면 false예요', async () => {
    respond({ orderId: 'o-1' });
    await expect(broker.cancel('o-1')).resolves.toBe(true);

    toss.request.mockRejectedValue(new TossApiError(422, 'not-cancelable', ''));
    await expect(broker.cancel('o-1')).resolves.toBe(false);

    toss.request.mockRejectedValue(
      new TossNoResponseError('/cancel', 'timeout'),
    );
    await expect(broker.cancel('o-1')).rejects.toThrow(TossNoResponseError);
  });

  it('복구 후보로 그 날 이후 OPEN·CLOSED 주문을 모아요', async () => {
    respond({
      orders: [
        {
          orderId: 'o-1',
          symbol: '005930',
          side: 'BUY',
          quantity: '3',
          price: '70000',
          orderedAt: '2026-10-29T09:30:00+09:00',
        },
      ],
    });

    const result = await broker.listOrders('005930', '2026-10-29');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      brokerOrderId: 'o-1',
      symbol: '005930',
      side: 'BUY',
      quantity: 3,
      price: 70_000,
      orderedAt: new Date('2026-10-29T00:30:00Z'),
    });
    expect(toss.request.mock.calls.map(([options]) => options.query)).toEqual([
      { status: 'OPEN', symbol: '005930', from: '2026-10-29' },
      { status: 'CLOSED', symbol: '005930', from: '2026-10-29' },
    ]);
  });
});
