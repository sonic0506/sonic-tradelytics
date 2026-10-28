import { readFile, rm, writeFile } from 'node:fs/promises';

import { Test } from '@nestjs/testing';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { env } from '@/config/env.js';

import { server } from '../../../test/setup/msw.js';
import { TossClient } from './toss.client.js';
import {
  TossApiError,
  TossNoResponseError,
  TossRateLimitedError,
} from './toss.errors.js';

const BASE = env.TOSS_API_BASE_URL;
const buyingPower = z.object({ cashBuyingPower: z.coerce.number() });

describe('TossClient', () => {
  let client: TossClient;
  let issued: number;

  // 토큰 발급 요청 수를 세고, 발급할 때마다 다른 토큰을 줘요
  const tokenHandler = http.post(`${BASE}/oauth2/token`, () => {
    issued += 1;
    return HttpResponse.json({
      access_token: `token-${issued}`,
      token_type: 'Bearer',
      expires_in: 86_400,
    });
  });

  beforeEach(async () => {
    issued = 0;
    await rm(env.TOSS_TOKEN_FILE, { force: true });
    server.use(tokenHandler);
    const moduleRef = await Test.createTestingModule({
      providers: [TossClient],
    }).compile();
    client = moduleRef.get(TossClient);
  });

  const getBuyingPower = (waitMs = 0): Promise<{ cashBuyingPower: number }> =>
    client.request({
      group: 'ORDER_INFO',
      path: '/api/v1/buying-power',
      query: { currency: 'KRW' },
      account: true,
      waitMs,
      result: buyingPower,
    });

  it('토큰을 발급해 파일에 저장하고, 계좌 헤더를 붙여 result를 검증해 돌려줘요', async () => {
    let headers: Headers | undefined;
    server.use(
      http.get(`${BASE}/api/v1/buying-power`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ result: { cashBuyingPower: '150000' } });
      }),
    );

    await expect(getBuyingPower()).resolves.toEqual({
      cashBuyingPower: 150_000,
    });
    expect(headers?.get('authorization')).toBe('Bearer token-1');
    expect(headers?.get('x-tossinvest-account')).toBe(env.TOSS_ACCOUNT_SEQ);
    expect(
      JSON.parse(await readFile(env.TOSS_TOKEN_FILE, 'utf8')),
    ).toMatchObject({ accessToken: 'token-1' });
  });

  it('저장된 토큰이 유효하면 다시 발급하지 않아요', async () => {
    await writeFile(
      env.TOSS_TOKEN_FILE,
      JSON.stringify({
        accessToken: 'saved',
        expiresAt: Date.now() + 3_600_000,
      }),
    );

    await client.ensureToken();

    expect(issued).toBe(0);
  });

  it('동시에 여러 번 불러도 토큰은 한 번만 발급해요', async () => {
    server.use(
      http.get(`${BASE}/api/v1/buying-power`, () =>
        HttpResponse.json({ result: { cashBuyingPower: '1' } }),
      ),
    );

    await Promise.all([getBuyingPower(), getBuyingPower(), getBuyingPower()]);

    expect(issued).toBe(1);
  });

  it('토큰이 무효(token-revoked)면 한 번만 다시 발급해 재시도해요', async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${BASE}/api/v1/buying-power`, ({ request }) => {
        const auth = request.headers.get('authorization') ?? '';
        seen.push(auth);
        if (auth === 'Bearer token-1')
          return HttpResponse.json(
            { error: { code: 'token-revoked', message: '대체됨' } },
            { status: 401 },
          );
        return HttpResponse.json({ result: { cashBuyingPower: '1' } });
      }),
    );

    await expect(getBuyingPower()).resolves.toEqual({ cashBuyingPower: 1 });
    expect(seen).toEqual(['Bearer token-1', 'Bearer token-2']);
  });

  it('다시 발급해도 401이면 더 재시도하지 않고 TossApiError를 던져요', async () => {
    server.use(
      http.get(`${BASE}/api/v1/buying-power`, () =>
        HttpResponse.json(
          { error: { code: 'token-revoked', message: '대체됨' } },
          { status: 401 },
        ),
      ),
    );

    await expect(getBuyingPower()).rejects.toMatchObject({
      status: 401,
      code: 'token-revoked',
    });
    expect(issued).toBe(2);
  });

  it('에러 응답은 토스 코드와 함께 TossApiError로 바꿔요', async () => {
    server.use(
      http.post(`${BASE}/api/v1/orders`, () =>
        HttpResponse.json(
          {
            error: {
              requestId: 'req-1',
              code: 'opposite-pending-order-exists',
              message: '반대 방향 미체결',
            },
          },
          { status: 409 },
        ),
      ),
    );

    const error: unknown = await client
      .request({
        group: 'ORDER',
        method: 'POST',
        path: '/api/v1/orders',
        body: { symbol: '005930' },
        account: true,
        waitMs: 2000,
        result: z.unknown(),
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TossApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'opposite-pending-order-exists',
      requestId: 'req-1',
    });
  });

  it('429를 받으면 Retry-After 동안 같은 그룹 호출을 보내지 않아요', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/v1/buying-power`, () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'rate-limit-exceeded', message: '초과' } },
          { status: 429, headers: { 'Retry-After': '5' } },
        );
      }),
    );

    await expect(getBuyingPower()).rejects.toMatchObject({ status: 429 });
    await expect(getBuyingPower()).rejects.toThrow(TossRateLimitedError);
    expect(calls).toBe(1);
  });

  it('응답 헤더가 한도를 다 썼다고 하면 기다리지 않는 호출은 보내지 않아요', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/v1/buying-power`, () => {
        calls += 1;
        return HttpResponse.json(
          { result: { cashBuyingPower: '1' } },
          {
            headers: { 'X-RateLimit-Limit': '6', 'X-RateLimit-Remaining': '0' },
          },
        );
      }),
    );

    await getBuyingPower();
    await expect(getBuyingPower()).rejects.toThrow(TossRateLimitedError);
    expect(calls).toBe(1);
  });

  it('응답을 받지 못하면 TossNoResponseError를 던져요', async () => {
    server.use(
      http.get(`${BASE}/api/v1/buying-power`, () => HttpResponse.error()),
    );

    await expect(getBuyingPower()).rejects.toThrow(TossNoResponseError);
  });
});
