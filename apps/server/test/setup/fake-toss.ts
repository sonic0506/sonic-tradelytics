import { Global, Module } from '@nestjs/common';
import type { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';

// e2e에서 engine 모듈(TossClient가 필요한 모듈)을 띄울 때 넣어요. 실제 토스를 부르지 않아요.
// 주문 가능 금액(buying-power)만 돌려주고, TossClient처럼 응답을 넘겨받은 스키마로 검증해요
export const FAKE_ORDERABLE_CASH = 1_000_000;

@Global()
@Module({
  providers: [
    {
      provide: TossClient,
      useValue: {
        request: ({ result }: { result: z.ZodType }) =>
          Promise.resolve(
            result.parse({
              currency: 'KRW',
              cashBuyingPower: String(FAKE_ORDERABLE_CASH),
            }),
          ),
      },
    },
  ],
  exports: [TossClient],
})
export class FakeTossModule {}
