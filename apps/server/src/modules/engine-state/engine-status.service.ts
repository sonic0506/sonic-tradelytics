import { Injectable } from '@nestjs/common';

import { kstDate } from '@/common/time/kst-date.js';
import {
  type MarketCalendar,
  MarketCalendarQueryService,
} from '@/modules/market-data/index.js';

import { EngineStatusNotFoundException } from './engine-state.exception.js';
import { EngineStateService } from './engine-state.service.js';
import { EngineStatusRepository } from './engine-status.repository.js';
import type { EngineStatus } from './entities/engine-status.entity.js';

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
    private readonly calendars: MarketCalendarQueryService,
  ) {}

  // GET /v1/engine-status: engine이 쓴 상태와 오늘 장 일정. engine이 한 번도 쓰지 않았으면 404
  async current(): Promise<{
    status: EngineStatus;
    today: MarketCalendar | null;
  }> {
    const [status, today] = await Promise.all([
      this.statuses.findCurrent(),
      this.calendars.findDay(kstDate()),
    ]);
    if (!status) throw new EngineStatusNotFoundException();
    return { status, today };
  }

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
