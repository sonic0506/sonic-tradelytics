import { Injectable } from '@nestjs/common';

import type { BotStatus } from './bot.constants.js';
import { BotRepository } from './bot.repository.js';
import type { Bot } from './entities/bot.entity.js';

// 봇 상태 변경은 engine만 해요 (docs/architecture/engine.md 모듈 배치). 설정 저장은 api 쪽에서 만들어요.
@Injectable()
export class BotService {
  constructor(private readonly bots: BotRepository) {}

  findById(id: number): Promise<Bot | null> {
    return this.bots.findById(id);
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
