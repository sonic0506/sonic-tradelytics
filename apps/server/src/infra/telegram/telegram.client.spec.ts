import { Test } from '@nestjs/testing';
import { http, HttpResponse } from 'msw';

import { server } from '../../../test/setup/msw.js';
import { TelegramClient, TelegramSendError } from './telegram.client.js';

const SEND_URL = 'https://api.telegram.org/bottest-bot-token/sendMessage';

describe('TelegramClient', () => {
  let client: TelegramClient;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TelegramClient],
    }).compile();
    client = moduleRef.get(TelegramClient);
  });

  it('토큰과 chat id가 있으면 켜져 있어요', () => {
    expect(client.isEnabled()).toBe(true);
  });

  it('chat id와 문장을 JSON으로 보내요', async () => {
    let body: unknown;
    server.use(
      http.post(SEND_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    await client.send('킬 스위치 작동');

    expect(body).toEqual({ chat_id: '42', text: '킬 스위치 작동' });
  });

  it('실패하면 상태 코드만 담아 던지고 토큰은 남기지 않아요', async () => {
    server.use(
      http.post(SEND_URL, () =>
        HttpResponse.json({ ok: false }, { status: 401 }),
      ),
    );

    const error = await client.send('x').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TelegramSendError);
    expect(String(error)).toContain('HTTP 401');
    expect(String(error)).not.toContain('test-bot-token');
  });

  it('응답이 없으면 URL 없이 던져요', async () => {
    server.use(http.post(SEND_URL, () => HttpResponse.error()));

    const error = await client.send('x').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TelegramSendError);
    expect(String(error)).not.toContain('test-bot-token');
  });
});
