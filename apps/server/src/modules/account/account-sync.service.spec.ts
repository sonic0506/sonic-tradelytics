import { Test } from '@nestjs/testing';

import { TossClient } from '@/infra/toss/toss.client.js';
import { OrderService } from '@/modules/order/index.js';

import { AccountSyncService } from './account-sync.service.js';

describe('AccountSyncService', () => {
  const toss = {
    request: vi.fn<(options: { query?: unknown }) => Promise<unknown>>(),
  };
  const orders = { applyReport: vi.fn<OrderService['applyReport']>() };
  let sync: AccountSyncService;

  // 토스 주문 1건 (숫자는 문자열로 와요)
  const tossOrder = (fields: Record<string, unknown> = {}) => ({
    orderId: 'o-1',
    symbol: '005930',
    side: 'BUY',
    orderType: 'LIMIT',
    timeInForce: 'DAY',
    status: 'PARTIAL_FILLED',
    price: '70000',
    quantity: '10',
    orderAmount: null,
    currency: 'KRW',
    orderedAt: '2026-10-29T09:30:00+09:00',
    canceledAt: null,
    execution: {
      filledQuantity: '4',
      averageFilledPrice: '70000',
      filledAmount: '280000',
      commission: '40',
      tax: '0',
      filledAt: '2026-10-29T09:31:00+09:00',
      settlementDate: '2026-10-31',
    },
    ...fields,
  });
  const page = (
    list: unknown[],
    nextCursor: string | null = null,
  ): { orders: unknown[]; nextCursor: string | null; hasNext: boolean } => ({
    orders: list,
    nextCursor,
    hasNext: nextCursor !== null,
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: new Date('2026-10-29T00:40:00Z') });
    orders.applyReport.mockResolvedValue('updated');
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountSyncService,
        { provide: TossClient, useValue: toss },
        { provide: OrderService, useValue: orders },
      ],
    }).compile();
    sync = moduleRef.get(AccountSyncService);
  });

  afterEach(() => {
    sync.stop();
    vi.useRealTimers();
  });

  it('전체 재동기화는 OPEN 전량과 오늘(KST) CLOSED를 끝 페이지까지 읽어 REST 값으로 반영해요', async () => {
    toss.request
      .mockResolvedValueOnce(page([tossOrder()]))
      .mockResolvedValueOnce(
        page([tossOrder({ orderId: 'o-2', status: 'FILLED' })], 'c-1'),
      )
      .mockResolvedValueOnce(
        page([tossOrder({ orderId: 'o-3', status: 'CANCELED' })]),
      );

    await sync.syncAll();

    expect(toss.request.mock.calls.map(([options]) => options.query)).toEqual([
      { status: 'OPEN' },
      {
        status: 'CLOSED',
        from: '2026-10-29',
        to: '2026-10-29',
        limit: 100,
        cursor: undefined,
      },
      {
        status: 'CLOSED',
        from: '2026-10-29',
        to: '2026-10-29',
        limit: 100,
        cursor: 'c-1',
      },
    ]);
    expect(toss.request).toHaveBeenCalledWith(
      expect.objectContaining({
        group: 'ORDER_HISTORY',
        path: '/api/v1/orders',
        account: true,
      }),
    );
    expect(
      orders.applyReport.mock.calls.map(([report, source]) => [
        report.brokerOrderId,
        source,
      ]),
    ).toEqual([
      ['o-1', 'rest'],
      ['o-2', 'rest'],
      ['o-3', 'rest'],
    ]);
  });

  it('토스 주문의 문자열 숫자와 시각을 바꿔 넘겨요', async () => {
    toss.request.mockResolvedValueOnce(page([tossOrder()]));
    toss.request.mockResolvedValueOnce(page([]));

    await sync.syncAll();

    const [report] = orders.applyReport.mock.calls[0] ?? [];
    expect(report).toEqual({
      brokerOrderId: 'o-1',
      symbol: '005930',
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      status: 'PARTIAL_FILLED',
      price: 70_000,
      quantity: 10,
      filledQuantity: 4,
      avgFilledPrice: 70_000,
      filledAmount: 280_000,
      commission: 40,
      tax: 0,
      orderedAt: new Date('2026-10-29T00:30:00Z'),
      canceledAt: null,
      filledAt: new Date('2026-10-29T00:31:00Z'),
      settlementDate: '2026-10-31',
      raw: tossOrder(),
    });
  });

  it('해외 주문과 모양이 다른 주문은 건너뛰어요', async () => {
    toss.request.mockResolvedValueOnce(
      page([tossOrder({ currency: 'USD' }), { orderId: 'broken' }]),
    );
    toss.request.mockResolvedValueOnce(page([]));

    await sync.syncAll();

    expect(orders.applyReport).not.toHaveBeenCalled();
  });

  it('조회가 실패하면 전체 재동기화가 실패해요', async () => {
    toss.request.mockRejectedValue(new Error('toss down'));

    await expect(sync.syncAll()).rejects.toThrow('toss down');
  });

  it('personal:order 이벤트는 order.status 기준으로 웹소켓 값으로 반영해요', async () => {
    sync.receive({
      event: 'FILL',
      accountSeq: '1',
      order: tossOrder({ status: 'FILLED' }),
    });
    await vi.waitFor(() => {
      expect(orders.applyReport).toHaveBeenCalledOnce();
    });

    const [report, source] = orders.applyReport.mock.calls[0] ?? [];
    expect(report?.status).toBe('FILLED');
    expect(source).toBe('ws');
  });

  it('모양이 다른 이벤트는 무시하고, 반영이 실패해도 다음 이벤트는 반영해요', async () => {
    orders.applyReport.mockRejectedValueOnce(new Error('db down'));

    sync.receive({ event: 'FILL' });
    sync.receive({ event: 'FILL', order: tossOrder({ orderId: 'o-1' }) });
    sync.receive({ event: 'FILL', order: tossOrder({ orderId: 'o-2' }) });
    await vi.waitFor(() => {
      expect(orders.applyReport).toHaveBeenCalledTimes(2);
    });

    expect(orders.applyReport.mock.calls[1]?.[0].brokerOrderId).toBe('o-2');
  });

  it('재동기화 중에 들어온 이벤트는 재동기화가 끝난 뒤에 반영해요', async () => {
    let finishOpen: (value: unknown) => void = () => undefined;
    toss.request
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOpen = resolve;
        }),
      )
      .mockResolvedValueOnce(page([]));

    const done = sync.syncAll();
    sync.receive({ event: 'FILL', order: tossOrder({ orderId: 'ws-1' }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(orders.applyReport).not.toHaveBeenCalled();

    finishOpen(page([tossOrder({ orderId: 'rest-1' })]));
    await done;
    await vi.waitFor(() => {
      expect(orders.applyReport).toHaveBeenCalledTimes(2);
    });

    expect(
      orders.applyReport.mock.calls.map(([report]) => report.brokerOrderId),
    ).toEqual(['rest-1', 'ws-1']);
  });

  it('시작하면 30초마다 OPEN을 다시 맞추고, 멈추면 그만둬요', async () => {
    toss.request.mockResolvedValue(page([tossOrder()]));

    sync.start(() => true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(toss.request).toHaveBeenCalledTimes(2);
    expect(toss.request).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: { status: 'OPEN' } }),
    );

    sync.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(toss.request).toHaveBeenCalledTimes(2);
  });

  it('주기 재동기화가 실패해도 다음 주기는 계속 돌아요', async () => {
    toss.request
      .mockRejectedValueOnce(new Error('toss down'))
      .mockResolvedValue(page([]));

    sync.start(() => true);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(toss.request).toHaveBeenCalledTimes(2);
  });

  it('장중이 아니면 주기 재동기화를 건너뛰어요', async () => {
    let isTradingHours = false;
    toss.request.mockResolvedValue(page([]));

    sync.start(() => isTradingHours);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(toss.request).not.toHaveBeenCalled();

    isTradingHours = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(toss.request).toHaveBeenCalledOnce();
  });

  it('재연결 뒤 재동기화는 실패해도 던지지 않아요', async () => {
    toss.request.mockRejectedValue(new Error('toss down'));

    sync.resync();
    await vi.advanceTimersByTimeAsync(0);

    expect(toss.request).toHaveBeenCalledWith(
      expect.objectContaining({ query: { status: 'OPEN' } }),
    );
  });
});
