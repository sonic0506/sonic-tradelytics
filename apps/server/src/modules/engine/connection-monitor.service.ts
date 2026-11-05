import { Injectable, Logger } from '@nestjs/common';

import { TossClient } from '@/infra/toss/toss.client.js';
import { TossSocket } from '@/infra/toss/toss-socket.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { MarketCalendarService } from '@/modules/market-data/index.js';
import { RiskService } from '@/modules/risk/index.js';

// 장중에 토스 연결이 계속 끊겨 있으면 신규 진입을 막고 알려요 (docs/architecture/engine.md 장애별 동작).
// 청산·손절은 막지 않고, 연결이 돌아오면 저절로 풀려요. 장 밖의 끊김은 보지 않아요.
@Injectable()
export class ConnectionMonitorService {
  private static readonly CHECK_MS = 5000;
  // 웹소켓 재연결과 짧은 토스 오류는 넘겨요 (처음 값 1분)
  private static readonly DOWN_LIMIT_MS = 60_000;

  private readonly logger = new Logger(ConnectionMonitorService.name);
  private timer: NodeJS.Timeout | undefined;
  private downSince: number | undefined;
  private isRecorded = false;

  constructor(
    private readonly toss: TossClient,
    private readonly socket: TossSocket,
    private readonly calendar: MarketCalendarService,
    private readonly engineState: EngineStateService,
    private readonly risk: RiskService,
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      void this.check();
    }, ConnectionMonitorService.CHECK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  async check(now = Date.now()): Promise<void> {
    const rest = this.toss.unreachableReason();
    const isSocketConnected = this.socket.isConnected();
    const isDown =
      (rest !== undefined || !isSocketConnected) &&
      this.calendar.isRegularSession(new Date(now));
    if (!isDown) {
      if (this.isRecorded) this.logger.log('토스 연결이 돌아왔어요');
      this.downSince = undefined;
      this.isRecorded = false;
      this.engineState.release('feed_stale');
      return;
    }

    this.downSince ??= now;
    if (now - this.downSince < ConnectionMonitorService.DOWN_LIMIT_MS) return;
    this.engineState.halt('feed_stale');
    if (this.isRecorded) return;
    this.isRecorded = true;
    this.logger.error(
      `토스 연결이 끊겨 신규 진입을 막아요: ${rest ?? '웹소켓'}`,
    );
    try {
      await this.risk.record('feed_stale', null, {
        rest: rest ?? null,
        socketConnected: isSocketConnected,
      });
    } catch (error) {
      this.isRecorded = false;
      this.logger.warn(`feed_stale을 남기지 못했어요: ${String(error)}`);
    }
  }
}
