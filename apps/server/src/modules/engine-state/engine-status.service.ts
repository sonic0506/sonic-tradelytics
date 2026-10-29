import { Injectable } from '@nestjs/common';

import { EngineStateService } from './engine-state.service.js';
import { EngineStatusRepository } from './engine-status.repository.js';

// engine 밖(시세·계좌)에서 모은 값
export interface EngineStatusReport {
  staleSymbols: string[];
  accountSyncedAt: Date | null;
}

// 화면용 engine 상태 한 행을 덮어써요 (docs/architecture/engine.md 화면용 상태 쓰기).
// api는 토스를 부르지 않아서 이 행으로 engine 상태를 봐요. heartbeat가 30초 넘게 오래되면 "엔진 응답 없음"이에요.
@Injectable()
export class EngineStatusService {
  constructor(
    private readonly engineState: EngineStateService,
    private readonly statuses: EngineStatusRepository,
  ) {}

  // ponytail: 주문 가능 금액·평가금액은 아직 잔고를 조회하지 않아 null이에요. 잔고 재동기화를 만들면 채워요
  async write(report: EngineStatusReport): Promise<void> {
    await this.statuses.save({
      state: this.engineState.state(),
      haltReasons: this.engineState.haltReasons(),
      staleSymbols: report.staleSymbols,
      orderableCash: null,
      holdingsValue: null,
      accountSyncedAt: report.accountSyncedAt,
      heartbeatAt: new Date(),
    });
  }
}
