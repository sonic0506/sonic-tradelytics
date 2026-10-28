import { TossRateLimitedError } from './toss.errors.js';

// 토스 호출 한도 그룹 (docs/integrations/toss-securities-api.md 호출 한도)
export type TossGroup =
  | 'AUTH'
  | 'ACCOUNT'
  | 'ASSET'
  | 'STOCK'
  | 'MARKET_INFO'
  | 'MARKET_DATA'
  | 'MARKET_DATA_CHART'
  | 'RANKING'
  | 'ORDER'
  | 'ORDER_HISTORY'
  | 'ORDER_INFO'
  | 'CONDITIONAL_ORDER'
  | 'CONDITIONAL_ORDER_HISTORY';

// 시작 값이에요. 실제 한도는 응답 헤더 X-RateLimit-*로 바꿔요(토스가 공지 없이 바꿀 수 있어요).
// ORDER_INFO는 09:00~09:10에 3이 되는데, 헤더로 따라가요.
const INITIAL_LIMITS: Record<TossGroup, number> = {
  AUTH: 5,
  ACCOUNT: 1,
  ASSET: 5,
  STOCK: 5,
  MARKET_INFO: 3,
  MARKET_DATA: 15,
  MARKET_DATA_CHART: 20,
  RANKING: 5,
  ORDER: 10,
  ORDER_HISTORY: 5,
  ORDER_INFO: 6,
  CONDITIONAL_ORDER: 5,
  CONDITIONAL_ORDER_HISTORY: 10,
};

interface Bucket {
  // 초당 한도 = 버킷 크기
  limit: number;
  tokens: number;
  refilledAt: number;
  // 429를 받으면 Retry-After까지 아무것도 보내지 않아요
  blockedUntil: number;
}

// 그룹별 토큰 버킷. 우선순위 큐는 두지 않아요(docs/learning/07-rate-limiting.md).
export class TossRateLimiter {
  private static readonly MS_PER_SECOND = 1000;
  private readonly buckets = new Map<TossGroup, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  // 한도가 있으면 하나 쓰고 true. 판단용 호출은 기다리지 않아요 (NFR-03)
  tryAcquire(group: TossGroup): boolean {
    const bucket = this.refill(group);
    if (bucket.blockedUntil > this.now() || bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  // 한도가 생길 때까지 기다려요. maxWaitMs를 넘기면 TossRateLimitedError
  async acquire(group: TossGroup, maxWaitMs = Infinity): Promise<void> {
    if (this.tryAcquire(group)) return;
    const wait = this.waitMs(group);
    if (wait > maxWaitMs) throw new TossRateLimitedError(group);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return this.acquire(group, maxWaitMs - wait);
  }

  // 응답 헤더로 한도와 남은 양을 맞춰요. 서버가 더 적게 남았다고 하면 그 값을 따라요
  update(group: TossGroup, limit: number, remaining: number): void {
    const bucket = this.refill(group);
    bucket.limit = limit;
    bucket.tokens = Math.min(bucket.tokens, remaining, limit);
  }

  // 429: Retry-After 동안 그 그룹을 막아요
  block(group: TossGroup, ms: number): void {
    const bucket = this.refill(group);
    bucket.tokens = 0;
    bucket.blockedUntil = Math.max(bucket.blockedUntil, this.now() + ms);
  }

  private waitMs(group: TossGroup): number {
    const bucket = this.refill(group);
    const blocked = bucket.blockedUntil - this.now();
    if (blocked > 0) return blocked;
    return Math.ceil(
      ((1 - bucket.tokens) * TossRateLimiter.MS_PER_SECOND) / bucket.limit,
    );
  }

  private refill(group: TossGroup): Bucket {
    const now = this.now();
    let bucket = this.buckets.get(group);
    if (!bucket) {
      const limit = INITIAL_LIMITS[group];
      bucket = { limit, tokens: limit, refilledAt: now, blockedUntil: 0 };
      this.buckets.set(group, bucket);
    }
    const elapsed = now - bucket.refilledAt;
    bucket.tokens = Math.min(
      bucket.limit,
      bucket.tokens + (elapsed * bucket.limit) / TossRateLimiter.MS_PER_SECOND,
    );
    bucket.refilledAt = now;
    return bucket;
  }
}
