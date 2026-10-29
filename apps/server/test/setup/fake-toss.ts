import { Global, Module } from '@nestjs/common';
import type { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';

// e2e에서 engine 모듈(TossClient가 필요한 모듈)을 띄울 때 넣어요. 실제 토스를 부르지 않아요.
// 주문 생성은 받아 주고(orderId = fake-<clientOrderId>), 나머지는 주문 가능 금액(buying-power)을 돌려줘요.
// TossClient처럼 응답을 넘겨받은 스키마로 검증해요
export const FAKE_ORDERABLE_CASH = 1_000_000;

interface FakeRequest {
  method?: string;
  path: string;
  body?: unknown;
  result: z.ZodType;
}

function respond({ method, path, body, result }: FakeRequest): unknown {
  if (method === 'POST' && path === '/api/v1/orders') {
    const clientOrderId =
      typeof body === 'object' && body !== null && 'clientOrderId' in body
        ? String(body.clientOrderId)
        : 'none';
    return result.parse({ orderId: `fake-${clientOrderId}` });
  }
  return result.parse({
    currency: 'KRW',
    cashBuyingPower: String(FAKE_ORDERABLE_CASH),
  });
}

@Global()
@Module({
  providers: [
    {
      provide: TossClient,
      useValue: {
        request: (options: FakeRequest) => Promise.resolve(respond(options)),
      },
    },
  ],
  exports: [TossClient],
})
export class FakeTossModule {}
