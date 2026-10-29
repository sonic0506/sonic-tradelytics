import { Test } from '@nestjs/testing';

import { TossClient } from '@/infra/toss/toss.client.js';
import { TossNoResponseError } from '@/infra/toss/toss.errors.js';
import {
  TossSocket,
  type TossSocketHandlers,
} from '@/infra/toss/toss-socket.js';

import { MarketCollectorService } from './market-collector.service.js';
import { QuoteCacheRepository } from './quote-cache.repository.js';

describe('MarketCollectorService', () => {
  const socket = {
    connect: vi.fn<TossSocket['connect']>(),
    declare: vi.fn<TossSocket['declare']>(),
    close: vi.fn<TossSocket['close']>(),
  };
  const toss = { request: vi.fn() };
  const quotes = { upsert: vi.fn<QuoteCacheRepository['upsert']>() };
  const orderStream = { onOrder: vi.fn(), onReconnected: vi.fn() };
  let collector: MarketCollectorService;

  // start()가 TossSocket에 넘긴 수신 함수로 프레임을 흘려 넣어요
  const frame = (topic: string, data: unknown): void => {
    const [handlers] = socket.connect.mock.lastCall ?? [];
    (handlers as TossSocketHandlers).onMessage(topic, data);
  };
  const trade = (symbol: string, price: string): void => {
    frame(`trade:kr:${symbol}`, {
      price,
      volume: '3',
      timestamp: '2026-10-29T09:00:00.000+09:00',
      currency: 'KRW',
    });
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: new Date('2026-10-29T00:00:00Z') });
    toss.request.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketCollectorService,
        { provide: TossSocket, useValue: socket },
        { provide: TossClient, useValue: toss },
        { provide: QuoteCacheRepository, useValue: quotes },
      ],
    }).compile();
    collector = moduleRef.get(MarketCollectorService);
    collector.start(orderStream);
  });

  afterEach(() => {
    collector.stop();
    vi.useRealTimers();
  });

  it('보유 종목을 먼저, 50종목까지만 체결·호가로 구독해요', () => {
    const candidates = Array.from({ length: 60 }, (_, i) =>
      String(i).padStart(6, '0'),
    );

    collector.watch(['999999'], candidates);

    const [declared] = socket.declare.mock.lastCall ?? [];
    expect(declared?.map(({ type }) => type)).toEqual([
      'trade:kr',
      'orderbook:kr',
      'personal:order',
    ]);
    expect(declared?.[0]?.codes).toHaveLength(50);
    expect(declared?.[0]?.codes[0]).toBe('999999');
  });

  it('시작하면 감시 종목이 없어도 계좌 주문 이벤트(personal:order)를 구독해요', () => {
    expect(socket.declare).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ type: 'personal:order', codes: ['1'] }]),
    );
  });

  it('주문 이벤트와 재연결은 해석하지 않고 그대로 넘겨요', () => {
    const data = { event: 'FILL', order: { orderId: 'a' } };

    frame('personal:order:1', data);
    const [handlers] = socket.connect.mock.lastCall ?? [];
    handlers?.onReconnected?.();

    expect(orderStream.onOrder).toHaveBeenCalledExactlyOnceWith(data);
    expect(orderStream.onReconnected).toHaveBeenCalledOnce();
  });

  it('체결·호가 프레임의 문자열 숫자를 숫자로 바꿔 스냅샷에 담아요', () => {
    collector.watch(['005930'], []);

    trade('005930', '230000');
    frame('orderbook:kr:005930', {
      currency: 'KRW',
      asks: [{ price: '230500', volume: '10' }],
      bids: [{ price: '230000', volume: '7' }],
    });

    expect(collector.snapshot('005930')).toEqual({
      price: 230_000,
      volume: 3,
      asks: [{ price: 230_500, volume: 10 }],
      bids: [{ price: 230_000, volume: 7 }],
      receivedAt: Date.now(),
    });
  });

  it('감시하지 않는 종목과 모양이 다른 프레임은 무시해요', () => {
    collector.watch(['005930'], []);

    trade('000660', '180000');
    frame('trade:kr:005930', { price: 'abc' });

    expect(collector.snapshot('000660')).toBeUndefined();
    expect(collector.snapshot('005930')).toBeUndefined();
  });

  it('30초 넘게 수신이 없는 종목만 prices로 한 번에 보정해요', async () => {
    collector.watch(['005930'], ['000660']);
    trade('005930', '230000');
    await vi.advanceTimersByTimeAsync(5000);
    toss.request.mockClear();
    trade('005930', '230500');
    toss.request.mockResolvedValue([{ symbol: '000660', lastPrice: 181_000 }]);

    await vi.advanceTimersByTimeAsync(5000);

    expect(toss.request).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        group: 'MARKET_DATA',
        path: '/api/v1/prices',
        query: { symbols: '000660' },
      }),
    );
    expect(collector.snapshot('000660')?.price).toBe(181_000);
  });

  it('보정이 실패하면 feed_stale로 막고, 시세가 다시 들어오면 풀어요', async () => {
    collector.watch(['005930'], []);
    trade('005930', '230000');
    vi.setSystemTime(Date.now() + 31_000);
    toss.request.mockRejectedValue(
      new TossNoResponseError('/api/v1/prices', 'timeout'),
    );

    await vi.advanceTimersByTimeAsync(5000);

    expect(collector.staleSymbols()).toEqual(['005930']);
    expect(collector.snapshot('005930')).toBeUndefined();

    trade('005930', '231000');

    expect(collector.staleSymbols()).toEqual([]);
    expect(collector.snapshot('005930')?.price).toBe(231_000);
  });

  it('보정 응답에 없는 종목도 feed_stale로 막아요', async () => {
    collector.watch(['005930', '000660'], []);
    toss.request.mockResolvedValue([{ symbol: '005930', lastPrice: 230_000 }]);

    await vi.advanceTimersByTimeAsync(5000);

    expect(collector.staleSymbols()).toEqual(['000660']);
    expect(collector.snapshot('005930')?.price).toBe(230_000);
  });

  it('보유 종목의 최근가만 quote_caches에 써요', async () => {
    collector.watch(['005930'], ['000660']);
    trade('005930', '230000');
    trade('000660', '180000');
    const receivedAt = new Date(Date.now());

    await vi.advanceTimersByTimeAsync(5000);

    expect(quotes.upsert).toHaveBeenLastCalledWith([
      { symbol: '005930', price: 230_000, receivedAt },
    ]);
  });

  it('quote_caches 쓰기가 실패해도 다음 주기는 계속 돌아요', async () => {
    collector.watch(['005930'], []);
    trade('005930', '230000');
    quotes.upsert.mockRejectedValueOnce(new Error('db down'));

    await vi.advanceTimersByTimeAsync(10_000);

    expect(quotes.upsert).toHaveBeenCalledTimes(2);
  });

  it('감시에서 빠진 종목은 스냅샷과 feed_stale에서 지워요', async () => {
    collector.watch(['005930'], []);
    trade('005930', '230000');
    vi.setSystemTime(Date.now() + 31_000);
    toss.request.mockRejectedValue(new Error('down'));
    await vi.advanceTimersByTimeAsync(5000);

    collector.watch([], ['000660']);

    expect(collector.snapshot('005930')).toBeUndefined();
    expect(collector.staleSymbols()).toEqual([]);
  });

  it('멈추면 웹소켓을 닫고 주기 작업을 멈춰요', async () => {
    collector.watch(['005930'], []);

    collector.stop();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(socket.close).toHaveBeenCalledOnce();
    expect(toss.request).not.toHaveBeenCalled();
  });
});
