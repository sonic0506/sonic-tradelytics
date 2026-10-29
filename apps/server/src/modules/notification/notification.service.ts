import { Injectable, Logger } from '@nestjs/common';

import { kstDateTime } from '@/common/time/kst-date.js';
import { TelegramClient } from '@/infra/telegram/telegram.client.js';
import {
  type RiskEvent,
  type RiskEventKind,
  RiskService,
} from '@/modules/risk/index.js';

const LABELS: Record<RiskEventKind, string> = {
  daily_stop: '하루 손실 한도 도달',
  total_stop: '누적 손실 한도 도달',
  streak_pause: '연속 손절로 일시정지',
  rate_cap: '주문 횟수 상한 초과',
  kill_switch: '킬 스위치 작동',
  batch_fail: '배치 실패',
  feed_stale: '시세 끊김',
  record_fail: '판단 기록 저장 실패',
  order_rejected: '주문 거부',
  funds_waiting: '투자금 대기',
  bot_error: '봇 오류',
};

// risk_events를 텔레그램으로 알려요 (POL-RISK-12). 기록이 먼저 커밋되고 여기서 따로 보내요.
// 아직 알리지 않은 행(notified_at null)을 다시 읽어서, 발송이 실패하거나 engine이 재시작해도 빠뜨리지 않아요.
@Injectable()
export class NotificationService {
  private static readonly POLL_MS = 5000;
  private static readonly BATCH = 20;

  private readonly logger = new Logger(NotificationService.name);
  private timer: NodeJS.Timeout | undefined;
  private isSending = false;

  constructor(
    private readonly telegram: TelegramClient,
    private readonly risk: RiskService,
  ) {}

  start(): void {
    if (!this.telegram.isEnabled()) {
      this.logger.warn('텔레그램 설정이 없어 알림을 보내지 않아요');
      return;
    }
    this.timer = setInterval(() => {
      void this.flush();
    }, NotificationService.POLL_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  // 알림이 실패해도 매매는 계속해요. 실패한 이벤트부터 다음 주기에 다시 보내요 (학습 11)
  async flush(): Promise<void> {
    if (this.isSending) return;
    this.isSending = true;
    try {
      const events = await this.risk.findUnnotified(NotificationService.BATCH);
      // 일어난 순서대로 하나씩. 앞이 실패하면 뒤를 먼저 보내지 않아요
      await events.reduce<Promise<void>>(
        (previous, event) =>
          previous.then(async () => {
            await this.telegram.send(format(event));
            await this.risk.markNotified(event.id);
          }),
        Promise.resolve(),
      );
    } catch (error) {
      this.logger.warn(
        `알림 발송 실패, 다음 주기에 다시 보내요: ${String(error)}`,
      );
    } finally {
      this.isSending = false;
    }
  }
}

function format(event: RiskEvent): string {
  const target = event.botId === null ? '전체' : `봇 #${event.botId}`;
  return [
    `[tradelytics] ${LABELS[event.kind]}`,
    `대상: ${target}`,
    `시각: ${kstDateTime(event.occurredAt)} (KST)`,
    `내용: ${JSON.stringify(event.detail)}`,
  ].join('\n');
}
