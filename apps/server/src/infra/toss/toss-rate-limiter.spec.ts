import { TossRateLimitedError } from './toss.errors.js';
import { TossRateLimiter } from './toss-rate-limiter.js';

describe('TossRateLimiter', () => {
  let now: number;
  let limiter: TossRateLimiter;

  beforeEach(() => {
    now = 0;
    limiter = new TossRateLimiter(() => now);
  });

  it('초당 한도만큼 쓰면 다음 호출은 기다리지 않고 거절해요', () => {
    for (let i = 0; i < 5; i += 1)
      expect(limiter.tryAcquire('ORDER_HISTORY')).toBe(true);

    expect(limiter.tryAcquire('ORDER_HISTORY')).toBe(false);
  });

  it('시간이 지나면 한도에 비례해 다시 채워요', () => {
    for (let i = 0; i < 5; i += 1) limiter.tryAcquire('ORDER_HISTORY');
    now = 200; // 초당 5 → 0.2초에 1개

    expect(limiter.tryAcquire('ORDER_HISTORY')).toBe(true);
    expect(limiter.tryAcquire('ORDER_HISTORY')).toBe(false);
  });

  it('그룹마다 따로 세요', () => {
    expect(limiter.tryAcquire('ACCOUNT')).toBe(true);
    expect(limiter.tryAcquire('ACCOUNT')).toBe(false);

    expect(limiter.tryAcquire('ASSET')).toBe(true);
  });

  it('응답 헤더가 더 적게 남았다고 하면 그 값을 따라요', () => {
    limiter.update('ORDER_INFO', 3, 0);

    expect(limiter.tryAcquire('ORDER_INFO')).toBe(false);
    now = 334; // 초당 3 → 약 0.33초에 1개
    expect(limiter.tryAcquire('ORDER_INFO')).toBe(true);
  });

  it('429를 받으면 Retry-After 동안 막아요', () => {
    limiter.block('MARKET_DATA', 2000);
    now = 1999;
    expect(limiter.tryAcquire('MARKET_DATA')).toBe(false);

    now = 2100;
    expect(limiter.tryAcquire('MARKET_DATA')).toBe(true);
  });

  it('기다리는 호출은 한도가 생기면 보내고, 최대 대기를 넘으면 거절해요', async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 5; i += 1) limiter.tryAcquire('ORDER_HISTORY');
      const waiting = limiter.acquire('ORDER_HISTORY', 1000);
      now = 200;
      await vi.advanceTimersByTimeAsync(200);
      await expect(waiting).resolves.toBeUndefined();

      limiter.block('ORDER_HISTORY', 5000);
      await expect(limiter.acquire('ORDER_HISTORY', 2000)).rejects.toThrow(
        TossRateLimitedError,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
