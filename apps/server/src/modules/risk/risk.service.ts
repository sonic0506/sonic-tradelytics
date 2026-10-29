import { Injectable } from '@nestjs/common';

import type { RiskEvent } from './entities/risk-event.entity.js';
import type { RiskEventKind } from './risk.constants.js';
import { RiskRepository } from './risk.repository.js';

// 리스크·장애 이벤트 기록 (POL-RISK-12 알림의 근거). 리스크 검사와 종목 잠금은 BotRunner를 만들 때 더해요.
@Injectable()
export class RiskService {
  constructor(private readonly events: RiskRepository) {}

  async record(
    kind: RiskEventKind,
    botId: number | null,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.events.add({ kind, botId, occurredAt: new Date(), detail });
  }

  // 알림(NotificationService)이 보낼 차례인 이벤트
  findUnnotified(take: number): Promise<RiskEvent[]> {
    return this.events.findUnnotified(take);
  }

  markNotified(id: number): Promise<void> {
    return this.events.markNotified(id, new Date());
  }

  // 이 종류의 마지막 이벤트 시각 (재시작 때 정지 상태 복원)
  async latestAt(kind: RiskEventKind): Promise<Date | undefined> {
    return (await this.events.findLatest(kind))?.occurredAt;
  }
}
