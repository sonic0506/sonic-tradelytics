import { Injectable } from '@nestjs/common';

import type { BotStatus } from './bot.constants.js';
import { BotRepository } from './bot.repository.js';
import type { Bot } from './entities/bot.entity.js';
import type { BotVersion } from './entities/bot-version.entity.js';

// 봇 설정과 지금 적용된 버전(1회 주문 금액 등). 적용된 버전이 없으면 null
export interface BotWithVersion {
  bot: Bot;
  version: BotVersion | null;
}

// 봇 상태 변경은 engine만 해요 (docs/architecture/engine.md 모듈 배치). 설정 저장은 api 쪽에서 만들어요.
@Injectable()
export class BotService {
  constructor(private readonly bots: BotRepository) {}

  async findWithVersions(ids: number[]): Promise<BotWithVersion[]> {
    if (ids.length === 0) return [];
    const [bots, versions] = await Promise.all([
      this.bots.findByIds(ids),
      this.bots.findAppliedVersions(ids),
    ]);
    // 버전은 봇마다 최신이 앞이라 처음 만난 것이 지금 버전이에요
    const current = new Map<number, BotVersion>();
    for (const version of versions)
      if (!current.has(version.botId)) current.set(version.botId, version);
    return bots.map((bot) => ({ bot, version: current.get(bot.id) ?? null }));
  }

  updateBudget(
    id: number,
    budget: Pick<Bot, 'budgetType' | 'budgetRatio' | 'budgetAmount'>,
  ): Promise<void> {
    return this.bots.updateBudget(id, budget);
  }

  findById(id: number): Promise<Bot | null> {
    return this.bots.findById(id);
  }

  // 실행 중·일시정지 봇과 지금 버전 (BotRunner가 주기마다 다시 읽어요). 일시정지 봇은 청산만 해요
  async findTrading(): Promise<BotWithVersion[]> {
    const running = await this.bots.findByStatuses(['running', 'paused']);
    return this.findWithVersions(running.map(({ id }) => id));
  }

  // 투자금을 확정할 봇: 실행 중이거나 자금 대기 중 (POL-FUND-15). 이미 확정된 봇은 FundService가 건너뛰어요
  findFundable(): Promise<Bot[]> {
    return this.bots.findByStatuses(['running', 'waiting_funds']);
  }

  // 신규 진입을 하지 않는 봇들 (재시작 때 정지 상태 복원)
  findInactive(): Promise<Bot[]> {
    return this.bots.findByStatuses(['paused', 'waiting_funds', 'stopped']);
  }

  setStatus(
    id: number,
    status: BotStatus,
    statusReason: string | null,
  ): Promise<void> {
    return this.bots.setStatus(id, status, statusReason);
  }

  stopAll(statusReason: string): Promise<void> {
    return this.bots.stopAll(statusReason);
  }
}
