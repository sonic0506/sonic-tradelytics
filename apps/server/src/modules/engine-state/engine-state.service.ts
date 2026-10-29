import { Injectable } from '@nestjs/common';

import type { EngineStateValue, HaltReason } from './engine-state.constants.js';

// 신규 진입을 막는 이유를 메모리에 모아 둬요 (docs/architecture/engine.md 정지 상태).
// BotRunner와 OrderService가 주문 직전에 매번 읽어요. 아무것도 가져오지 않아서 누구나 불러도 순환이 생기지 않아요.
// 같은 내용은 bots.status·risk_events에도 남고, 재시작하면 CommandService.restore()가 다시 채워요.
@Injectable()
export class EngineStateService {
  private readonly halts = new Set<HaltReason>();
  // 봇 id → 정지 사유 (pause, daily_stop, bot_error 등)
  private readonly blockedBots = new Map<number, string>();

  halt(reason: HaltReason): void {
    this.halts.add(reason);
  }

  release(reason: HaltReason): void {
    this.halts.delete(reason);
  }

  blockBot(botId: number, reason: string): void {
    this.blockedBots.set(botId, reason);
  }

  unblockBot(botId: number): void {
    this.blockedBots.delete(botId);
  }

  // 이 봇이 신규 진입할 수 있는지. 청산·손절·미체결 취소는 이 값과 관계없이 해요
  canEnter(botId: number): boolean {
    return this.halts.size === 0 && !this.blockedBots.has(botId);
  }

  // 주문 호출 자체를 할 수 있는지. 종료 중에는 청산도 내지 않아요
  canOrder(): boolean {
    return !this.halts.has('stopping');
  }

  haltReasons(): HaltReason[] {
    return [...this.halts];
  }

  botBlockReason(botId: number): string | undefined {
    return this.blockedBots.get(botId);
  }

  state(): EngineStateValue {
    if (this.halts.has('stopping')) return 'stopping';
    return this.halts.size > 0 ? 'halted' : 'running';
  }
}
