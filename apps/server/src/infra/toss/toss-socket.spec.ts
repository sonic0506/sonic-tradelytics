import { Test } from '@nestjs/testing';

import { env } from '@/config/env.js';

import { TossClient } from './toss.client.js';
import { TossSocket } from './toss-socket.js';

// 토스 웹소켓 대신 쓰는 가짜 연결이에요. 테스트가 열기·수신·끊김을 직접 일으켜요
class FakeSocket extends EventTarget {
  static readonly OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];

  constructor(
    readonly url: string,
    readonly init: { headers: Record<string, string> },
  ) {
    super();
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  receive(frame: unknown): void {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(frame) }),
    );
  }

  drop(): void {
    this.readyState = 3;
    this.dispatchEvent(
      Object.assign(new Event('close'), { code: 1006, reason: '' }),
    );
  }
}

describe('TossSocket', () => {
  const toss = { accessToken: vi.fn<TossClient['accessToken']>() };
  const onMessage = vi.fn();
  const onReconnected = vi.fn();
  let socket: TossSocket;

  const last = (): FakeSocket => {
    const instance = FakeSocket.instances.at(-1);
    if (!instance) throw new Error('연결이 없어요');
    return instance;
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    FakeSocket.instances = [];
    toss.accessToken.mockResolvedValue('token-1');
    const moduleRef = await Test.createTestingModule({
      providers: [TossSocket, { provide: TossClient, useValue: toss }],
    }).compile();
    socket = moduleRef.get(TossSocket);
  });

  afterEach(() => {
    socket.close();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const connect = async (): Promise<FakeSocket> => {
    socket.connect({ onMessage, onReconnected });
    await vi.advanceTimersByTimeAsync(0);
    return last();
  };

  it('토큰을 Authorization 헤더로 보내고, 열리면 종목이 있는 선언만 보내요', async () => {
    socket.declare([
      { type: 'trade:kr', codes: ['005930'] },
      { type: 'orderbook:kr', codes: [] },
    ]);
    const ws = await connect();

    ws.open();

    expect(ws.url).toBe(env.TOSS_WS_URL);
    expect(ws.init.headers).toEqual({ Authorization: 'Bearer token-1' });
    expect(ws.sent).toEqual([
      JSON.stringify([{ type: 'trade:kr', codes: ['005930'] }]),
    ]);
  });

  it('열린 뒤 선언을 바꾸면 바로 전체를 다시 보내요', async () => {
    const ws = await connect();
    ws.open();

    socket.declare([{ type: 'trade:kr', codes: ['000660'] }]);

    expect(ws.sent.at(-1)).toBe(
      JSON.stringify([{ type: 'trade:kr', codes: ['000660'] }]),
    );
  });

  it('시세 프레임만 topic과 data로 넘기고 ack·pong은 넘기지 않아요', async () => {
    const ws = await connect();
    ws.open();
    const data = { price: '230000', volume: '1' };

    ws.receive({ type: 'subscriptions', subscribed: [], rejected: [] });
    ws.receive({ type: 'pong' });
    ws.receive({ type: 'message', topic: 'trade:kr:005930', data });

    expect(onMessage).toHaveBeenCalledExactlyOnceWith('trade:kr:005930', data);
  });

  it('60초마다 PING을 보내요', async () => {
    const ws = await connect();
    ws.open();

    await vi.advanceTimersByTimeAsync(120_000);

    expect(ws.sent.filter((frame) => frame === 'PING')).toHaveLength(2);
  });

  it('끊기면 다시 연결해 같은 선언을 보내고 재연결을 알려요', async () => {
    socket.declare([{ type: 'trade:kr', codes: ['005930'] }]);
    const first = await connect();
    first.open();
    expect(onReconnected).not.toHaveBeenCalled();

    first.drop();
    await vi.advanceTimersByTimeAsync(1000);
    const second = last();
    second.open();

    expect(second).not.toBe(first);
    expect(second.sent).toEqual(first.sent);
    expect(onReconnected).toHaveBeenCalledOnce();
  });

  it('토큰을 받지 못하면 연결하지 않고 다시 시도해요', async () => {
    toss.accessToken.mockRejectedValueOnce(new Error('발급 실패'));

    socket.connect({ onMessage });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.instances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);

    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('close 뒤에는 끊겨도 다시 연결하지 않아요', async () => {
    const ws = await connect();
    ws.open();

    socket.close();
    ws.drop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(FakeSocket.instances).toHaveLength(1);
  });
});
