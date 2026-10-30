import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

import { kstAt } from '@/common/time/kst-date.js';
import { BotService } from '@/modules/bot/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';

import type { RiskEvent } from './entities/risk-event.entity.js';
import type { RiskEventKind, StopReason } from './risk.constants.js';
import { RiskRepository } from './risk.repository.js';
import { SymbolLockRepository } from './symbol-lock.repository.js';

// 한도에 걸린 봇의 상태 (POL-RISK-02~04, 08). 누적 한도만 봇 종료예요
const STOPPED_STATUS = {
  daily_stop: 'paused',
  total_stop: 'stopped',
  streak_pause: 'paused',
  rate_cap: 'paused',
} as const;

// 리스크 기록, 종목 잠금, 한도에 걸린 봇 정지 (docs/policy/risk-management.md).
// 한도 판단은 limits.rule.ts·entry.rule.ts가 하고, 여기서는 결과를 상태와 기록으로 남겨요.
const DAY_MS = 86_400_000;

@Injectable()
export class RiskService {
  constructor(
    private readonly events: RiskRepository,
    private readonly locks: SymbolLockRepository,
    private readonly bots: BotService,
    private readonly engineState: EngineStateService,
  ) {}

  // POL-RISK-16: 한 종목은 한 봇만. 이미 이 봇이 잡고 있으면(분할 매수) 그대로 true예요
  async acquireLock(symbol: string, botId: number): Promise<boolean> {
    const held = await this.locks.findActive(symbol);
    if (held) return held.botId === botId;
    return this.locks.add(symbol, botId, new Date());
  }

  // 전량 청산·미체결 취소·손절 조건주문 정리가 끝난 뒤에 불러요
  async releaseLock(symbol: string, botId: number): Promise<void> {
    await this.locks.release(symbol, botId, new Date());
  }

  // 한도에 걸린 봇을 멈춰요. 신규 진입 차단은 DB보다 먼저 메모리에 걸어요
  async stopBot(
    botId: number,
    reason: StopReason,
    detail: Record<string, unknown>,
  ): Promise<void> {
    this.engineState.blockBot(botId, reason);
    await this.saveStop(botId, reason, detail);
  }

  // POL-RISK-02: 하루 손실 한도로 멈춘 봇은 다음 거래일에 자동으로 다시 돌아요 (pre_open 배치)
  async resumeDailyStops(): Promise<number[]> {
    const stopped = (await this.bots.findInactive()).filter(
      ({ status, statusReason }) =>
        status === 'paused' && statusReason === 'daily_stop',
    );
    await stopped.reduce<Promise<void>>(
      (previous, { id }) =>
        previous.then(async () => {
          await this.bots.setStatus(id, 'running', null);
          this.engineState.unblockBot(id);
        }),
      Promise.resolve(),
    );
    return stopped.map(({ id }) => id);
  }

  @Transactional()
  private async saveStop(
    botId: number,
    reason: StopReason,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.bots.setStatus(botId, STOPPED_STATUS[reason], reason);
    await this.record(reason, botId, detail);
  }

  async record(
    kind: RiskEventKind,
    botId: number | null,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.events.add({ kind, botId, occurredAt: new Date(), detail });
  }

  // GET /v1/risk-events. 기간은 KST 거래일(둘 다 포함)이에요
  findPage(query: {
    botIds?: string[];
    kinds?: RiskEventKind[];
    from?: string;
    to?: string;
    skip: number;
    size: number;
  }): Promise<[RiskEvent[], number]> {
    return this.events.findPage({
      botIds: query.botIds?.map(Number),
      kinds: query.kinds,
      from: query.from === undefined ? undefined : kstAt(query.from, '00:00'),
      until:
        query.to === undefined
          ? undefined
          : new Date(kstAt(query.to, '00:00').getTime() + DAY_MS),
      skip: query.skip,
      take: query.size,
    });
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
