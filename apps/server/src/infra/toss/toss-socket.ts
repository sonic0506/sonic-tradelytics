import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { env } from '@/config/env.js';

import { TossClient } from './toss.client.js';

// 구독 선언 한 항목. personal:order의 codes에는 종목이 아니라 accountSeq를 넣어요
export interface TossSubscription {
  type: 'trade:kr' | 'orderbook:kr' | 'personal:order';
  codes: string[];
}

export interface TossSocketHandlers {
  // 시세·주문 프레임. 서버는 수신이 2초 넘게 막히면 끊어서, 여기서는 동기로 짧게 처리해요
  onMessage: (topic: string, data: unknown) => void;
  // 다시 연결해 재선언한 뒤. 끊긴 동안의 personal:order는 다시 오지 않아 재동기화가 필요해요
  onReconnected?: () => void;
}

// 모르는 type(server-shutdown 등)은 무시해요. 끊기면 close에서 다시 연결해요
const frameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message'),
    topic: z.string(),
    data: z.unknown(),
  }),
  z.object({
    type: z.literal('subscriptions'),
    rejected: z.array(z.object({ target: z.string(), code: z.string() })),
  }),
  z.object({
    type: z.literal('error'),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
  z.object({ type: z.literal('pong') }),
]);

// 토스 웹소켓 연결 1개를 유지해요(ADR-0007). 계정당 연결이 2개뿐이라 engine에서 MarketCollector만 써요.
// 구독은 선언형이라 마지막 선언을 기억해 두고, 다시 연결하면 그대로 다시 보내요.
@Injectable()
export class TossSocket {
  // 서버는 180초 동안 받은 게 없으면 끊어요
  private static readonly PING_MS = 60_000;
  private static readonly FIRST_RETRY_MS = 1000;
  private static readonly MAX_RETRY_MS = 30_000;
  private static readonly NORMAL_CLOSE = 1000;
  private static readonly RETRY_FACTOR = 2;
  private static readonly LOG_PREVIEW = 100;

  private readonly logger = new Logger(TossSocket.name);
  private socket: WebSocket | undefined;
  private handlers: TossSocketHandlers | undefined;
  private subscriptions: TossSubscription[] = [];
  private ping: NodeJS.Timeout | undefined;
  private retry: NodeJS.Timeout | undefined;
  private retryMs = TossSocket.FIRST_RETRY_MS;
  private hasConnected = false;
  private isClosed = true;

  constructor(private readonly toss: TossClient) {}

  // 연결에 실패해도 던지지 않고 계속 다시 시도해요. 그동안 시세는 MarketCollector가 REST로 보정해요
  connect(handlers: TossSocketHandlers): void {
    this.handlers = handlers;
    this.isClosed = false;
    this.reopen();
  }

  // 구독 전체를 이 목록으로 바꿔요. 종목이 없는 항목은 빼요(서버는 빈 codes를 받지 않아요)
  declare(subscriptions: TossSubscription[]): void {
    this.subscriptions = subscriptions.filter(({ codes }) => codes.length > 0);
    this.sendDeclaration();
  }

  close(): void {
    this.isClosed = true;
    clearTimeout(this.retry);
    clearInterval(this.ping);
    this.socket?.close(TossSocket.NORMAL_CLOSE, 'engine stop');
    this.socket = undefined;
  }

  private reopen(): void {
    this.open().catch((error: unknown) => {
      this.logger.error(`웹소켓 연결 실패: ${String(error)}`);
      this.scheduleRetry();
    });
  }

  private async open(): Promise<void> {
    const token = await this.toss.accessToken();
    if (this.isClosed) return;
    // Node 내장 WebSocket(undici)은 headers 옵션을 받아요
    const socket = new WebSocket(env.TOSS_WS_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.retryMs = TossSocket.FIRST_RETRY_MS;
      this.sendDeclaration();
      this.ping = setInterval(() => {
        socket.send('PING');
      }, TossSocket.PING_MS);
      this.logger.log('웹소켓 연결');
      if (this.hasConnected) this.handlers?.onReconnected?.();
      this.hasConnected = true;
    });
    socket.addEventListener('message', (event) => {
      const data: unknown = event.data;
      if (typeof data === 'string') this.receive(data);
    });
    socket.addEventListener('close', ({ code, reason }) => {
      clearInterval(this.ping);
      if (this.socket !== socket || this.isClosed) return;
      this.socket = undefined;
      this.logger.warn(`웹소켓 끊김 code=${code} reason=${reason || '-'}`);
      this.scheduleRetry();
    });
  }

  private scheduleRetry(): void {
    if (this.isClosed) return;
    this.retry = setTimeout(() => {
      this.reopen();
    }, this.retryMs);
    this.retryMs = Math.min(
      this.retryMs * TossSocket.RETRY_FACTOR,
      TossSocket.MAX_RETRY_MS,
    );
  }

  private sendDeclaration(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(this.subscriptions));
  }

  private receive(text: string): void {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      this.logger.warn(
        `JSON이 아닌 프레임: ${text.slice(0, TossSocket.LOG_PREVIEW)}`,
      );
      return;
    }
    const parsed = frameSchema.safeParse(json);
    if (!parsed.success) return;
    const frame = parsed.data;
    if (frame.type === 'message')
      this.handlers?.onMessage(frame.topic, frame.data);
    else if (frame.type === 'subscriptions')
      for (const { target, code } of frame.rejected)
        this.logger.warn(`구독 거부 ${target}: ${code}`);
    else if (frame.type === 'error')
      this.logger.warn(
        `웹소켓 오류 ${frame.error.code}: ${frame.error.message}`,
      );
  }
}
