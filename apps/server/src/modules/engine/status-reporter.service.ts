import { Injectable, Logger } from '@nestjs/common';

import { AccountSyncService } from '@/modules/account/index.js';
import { EngineStatusService } from '@/modules/engine-state/index.js';
import { MarketCollectorService } from '@/modules/market-data/index.js';

// engine_statuses를 5초마다 덮어써요 (docs/architecture/engine.md 화면용 상태 쓰기).
// 여러 feature의 값을 모아야 해서 engine에 둬요. 쓰기가 실패해도 매매는 계속해요.
@Injectable()
export class StatusReporterService {
  private static readonly REPORT_MS = 5000;

  private readonly logger = new Logger(StatusReporterService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly status: EngineStatusService,
    private readonly marketCollector: MarketCollectorService,
    private readonly accountSync: AccountSyncService,
  ) {}

  start(): void {
    void this.report();
    this.timer = setInterval(() => {
      void this.report();
    }, StatusReporterService.REPORT_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  async report(): Promise<void> {
    try {
      await this.status.write({
        staleSymbols: this.marketCollector.staleSymbols(),
        accountSyncedAt: this.accountSync.lastSyncedAt() ?? null,
      });
    } catch (error) {
      this.logger.warn(`engine 상태를 쓰지 못했어요: ${String(error)}`);
    }
  }
}
