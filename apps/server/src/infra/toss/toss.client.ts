import { readFile, rm, writeFile } from 'node:fs/promises';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { env } from '@/config/env.js';

import {
  TossApiError,
  TossConfigError,
  TossNoResponseError,
  TossRateLimitedError,
} from './toss.errors.js';
import { type TossGroup, TossRateLimiter } from './toss-rate-limiter.js';

export interface TossRequest<S extends z.ZodType> {
  group: TossGroup;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  // 계좌·자산·주문·조건주문 API는 X-Tossinvest-Account가 필요해요
  account?: boolean;
  // 호출 한도를 기다릴 최대 시간(ms). 0이면 기다리지 않고 TossRateLimitedError (판단용 호출, NFR-03)
  waitMs: number;
  // 응답 result의 모양. 토스는 숫자를 문자열로 주는 곳이 많아서 z.coerce.number()로 바꿔요
  result: S;
}

const storedTokenSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.number(),
});
type StoredToken = z.infer<typeof storedTokenSchema>;

const issuedTokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

// 일반 API는 { error: { code, message, data, requestId } }, 토큰 발급은 OAuth 형식 { error, error_description }
const errorBodySchema = z.union([
  z.object({
    error: z.object({
      code: z.string(),
      message: z.string().optional(),
      data: z.unknown().optional(),
      requestId: z.string().optional(),
    }),
  }),
  z.object({
    error: z.string(),
    error_description: z.string().optional(),
  }),
]);

// 토큰을 다시 받으면 해결되는 401
const TOKEN_ERROR_CODES = new Set([
  'token-revoked',
  'expired-token',
  'invalid-token',
]);

// 토스 Open API를 부르는 유일한 곳이에요(ADR-0002). engine 프로세스에만 있어요.
// 토큰은 클라이언트당 1개만 유효해서 여기서만 발급하고, 파일에 저장해 재시작해도 다시 발급하지 않아요(R-014).
@Injectable()
export class TossClient {
  // 만료 5분 전부터는 새로 발급해요
  private static readonly REFRESH_MARGIN_MS = 300_000;
  private static readonly TIMEOUT_MS = 10_000;
  private static readonly MS_PER_SECOND = 1000;

  private readonly logger = new Logger(TossClient.name);
  private readonly limiter = new TossRateLimiter();
  private readonly clientId: string;
  private readonly clientSecret: string;
  private token: StoredToken | undefined;
  // 동시에 여러 호출이 토큰을 기다려도 발급은 한 번만 해요
  private issuing: Promise<string> | undefined;

  constructor() {
    if (!env.TOSS_CLIENT_ID || !env.TOSS_CLIENT_SECRET)
      throw new TossConfigError(
        'TOSS_CLIENT_ID, TOSS_CLIENT_SECRET이 필요해요',
      );
    this.clientId = env.TOSS_CLIENT_ID;
    this.clientSecret = env.TOSS_CLIENT_SECRET;
  }

  // 성공 응답의 result를 검증해 돌려줘요. 실패는 TossApiError·TossNoResponseError·TossRateLimitedError
  async request<S extends z.ZodType>(
    options: TossRequest<S>,
  ): Promise<z.infer<S>> {
    return this.send(options, false);
  }

  // engine 시작 순서 2번: 저장된 토큰을 읽고, 없거나 만료가 가까우면 발급해요
  async ensureToken(): Promise<void> {
    await this.accessToken();
  }

  private async send<S extends z.ZodType>(
    options: TossRequest<S>,
    tokenRetried: boolean,
  ): Promise<z.infer<S>> {
    const { group, method = 'GET', path, query, body, account } = options;
    if (options.waitMs === 0) {
      if (!this.limiter.tryAcquire(group))
        throw new TossRateLimitedError(group);
    } else {
      await this.limiter.acquire(group, options.waitMs);
    }

    const token = await this.accessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (account) headers['X-Tossinvest-Account'] = this.accountSeq();
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await this.fetch(path, this.url(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.syncLimit(group, response.headers);

    if (response.ok) {
      if (response.status === HttpStatus.NO_CONTENT)
        return options.result.parse(undefined);
      const envelope = z
        .object({ result: z.unknown() })
        .parse(await response.json());
      return options.result.parse(envelope.result);
    }

    const error = await this.toError(response);
    if (
      response.status === HttpStatus.UNAUTHORIZED &&
      !tokenRetried &&
      TOKEN_ERROR_CODES.has(error.code)
    ) {
      this.logger.warn(`토큰 거절(${error.code}), 다시 발급해요`);
      await this.discardToken(token);
      return this.send(options, true);
    }
    if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfter = Number(response.headers.get('retry-after') ?? 1);
      this.limiter.block(group, retryAfter * TossClient.MS_PER_SECOND);
    }
    throw error;
  }

  // 웹소켓 연결(TossSocket)도 같은 토큰을 써요. 토큰 값은 로그에 남기지 않아요
  async accessToken(): Promise<string> {
    if (this.token && this.isFresh(this.token)) return this.token.accessToken;
    this.issuing ??= this.loadOrIssue().finally(() => {
      this.issuing = undefined;
    });
    return this.issuing;
  }

  private async loadOrIssue(): Promise<string> {
    const saved = await this.readTokenFile();
    if (saved && this.isFresh(saved)) {
      this.token = saved;
      return saved.accessToken;
    }
    return this.issue();
  }

  private async issue(): Promise<string> {
    await this.limiter.acquire('AUTH');
    const response = await this.fetch(
      '/oauth2/token',
      this.url('/oauth2/token'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      },
    );
    if (!response.ok) throw await this.toError(response);

    const issued = issuedTokenSchema.parse(await response.json());
    this.token = {
      accessToken: issued.access_token,
      expiresAt: Date.now() + issued.expires_in * TossClient.MS_PER_SECOND,
    };
    // 토큰 값은 로그에 남기지 않아요
    this.logger.log(`토큰 발급 (유효 ${issued.expires_in}초)`);
    await writeFile(env.TOSS_TOKEN_FILE, JSON.stringify(this.token), {
      mode: 0o600,
    });
    return issued.access_token;
  }

  // 거절된 토큰을 버려요. 파일도 지워서 다시 읽지 않게 해요
  private async discardToken(token: string): Promise<void> {
    if (this.token?.accessToken !== token) return;
    this.token = undefined;
    await rm(env.TOSS_TOKEN_FILE, { force: true });
  }

  private async readTokenFile(): Promise<StoredToken | undefined> {
    let text: string;
    try {
      text = await readFile(env.TOSS_TOKEN_FILE, 'utf8');
    } catch (error) {
      // 파일이 없으면 새로 발급해요. 그 밖의 오류(권한 등)는 그대로 알려요
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return undefined;
      throw error;
    }
    // 모양이 깨진 파일은 없는 것으로 보고 새로 발급해요
    const parsed = storedTokenSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  }

  private isFresh(token: StoredToken): boolean {
    return token.expiresAt - TossClient.REFRESH_MARGIN_MS > Date.now();
  }

  private accountSeq(): string {
    if (!env.TOSS_ACCOUNT_SEQ)
      throw new TossConfigError('TOSS_ACCOUNT_SEQ가 필요해요');
    return env.TOSS_ACCOUNT_SEQ;
  }

  private url(path: string, query?: TossRequest<z.ZodType>['query']): string {
    const url = new URL(path, env.TOSS_API_BASE_URL);
    for (const [key, value] of Object.entries(query ?? {}))
      if (value !== undefined) url.searchParams.set(key, String(value));
    return url.toString();
  }

  private async fetch(
    path: string,
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(TossClient.TIMEOUT_MS),
      });
    } catch (error) {
      throw new TossNoResponseError(path, error);
    }
  }

  private syncLimit(group: TossGroup, headers: Headers): void {
    const limit = Number(headers.get('x-ratelimit-limit'));
    const remaining = headers.get('x-ratelimit-remaining');
    if (limit > 0 && remaining !== null)
      this.limiter.update(group, limit, Number(remaining));
  }

  private async toError(response: Response): Promise<TossApiError> {
    const json: unknown = await response.json().catch(() => undefined);
    const parsed = errorBodySchema.safeParse(json);
    if (!parsed.success)
      return new TossApiError(
        response.status,
        'unknown',
        response.statusText,
        undefined,
        response.headers.get('x-request-id') ?? undefined,
      );
    const { error } = parsed.data;
    if (typeof error === 'string')
      return new TossApiError(
        response.status,
        error,
        'error_description' in parsed.data
          ? (parsed.data.error_description ?? '')
          : '',
      );
    return new TossApiError(
      response.status,
      error.code,
      error.message ?? response.statusText,
      error.data,
      error.requestId ?? response.headers.get('x-request-id') ?? undefined,
    );
  }
}
