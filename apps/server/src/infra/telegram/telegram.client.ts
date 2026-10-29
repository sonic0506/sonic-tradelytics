import { Injectable } from '@nestjs/common';

import { env } from '@/config/env.js';

export class TelegramSendError extends Error {}

// 텔레그램 Bot API로 메시지를 보내요 (POL-RISK-12, 학습 11). engine에서만 써요.
// 봇 토큰이 URL에 들어가서, 에러와 로그에는 URL을 남기지 않아요.
@Injectable()
export class TelegramClient {
  private static readonly BASE_URL = 'https://api.telegram.org';
  private static readonly TIMEOUT_MS = 10_000;

  // 토큰과 chat id가 모두 있어야 보내요
  isEnabled(): boolean {
    return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
  }

  async send(text: string): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId)
      throw new TelegramSendError(
        'TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID가 필요해요',
      );

    let response: Response;
    try {
      response = await fetch(
        `${TelegramClient.BASE_URL}/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
          signal: AbortSignal.timeout(TelegramClient.TIMEOUT_MS),
        },
      );
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown';
      throw new TelegramSendError(`텔레그램 응답 없음 (${reason})`);
    }
    if (!response.ok)
      throw new TelegramSendError(
        `텔레그램 발송 실패 (HTTP ${response.status})`,
      );
  }
}
