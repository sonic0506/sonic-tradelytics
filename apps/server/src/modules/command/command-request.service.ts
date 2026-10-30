import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

import { BotService } from '@/modules/bot/index.js';

import type { CommandKind } from './command.constants.js';
import {
  BotNotFoundException,
  CommandNotAllowedException,
  CommandNotFoundException,
} from './command.exception.js';
import { CommandRepository } from './command.repository.js';
import type { CreateCommandDto } from './dto/create-command.dto.js';
import type { Command } from './entities/command.entity.js';

// api 쪽 명령 저장 (ADR-0004). commands 행과 NOTIFY command를 한 트랜잭션으로 남기고, 실행은 engine이 해요.
// 봇 상태로 바로 거를 수 있는 것만 여기서 막아요. 실행 직전 검사는 engine이 다시 해요 (api.md 원칙 3)
@Injectable()
export class CommandRequestService {
  constructor(
    private readonly commands: CommandRepository,
    private readonly bots: BotService,
  ) {}

  // ponytail: rebudget의 쉬는 중·운용 자산 검사(BOT_NOT_RESTING·BUDGET_INSUFFICIENT)는 아직 engine만 해요.
  // 결과는 commands.result = failed와 error로 와요. 봇 화면 API(4b)에서 같은 계산을 api에도 붙여요
  @Transactional()
  async create(request: CreateCommandDto): Promise<Command> {
    const botId =
      request.kind === 'kill' || request.botId === undefined
        ? null
        : Number(request.botId);
    if (botId !== null) await this.assertAllowed(request.kind, botId);
    const command = await this.commands.add({
      kind: request.kind,
      botId,
      liquidateAll: request.kind === 'kill' && request.liquidateAll === true,
      budget: request.kind === 'rebudget' ? { ...request.budget } : null,
      requestedAt: new Date(),
    });
    await this.commands.notify();
    return command;
  }

  async find(id: number): Promise<Command> {
    const command = await this.commands.findById(id);
    if (!command) throw new CommandNotFoundException(id);
    return command;
  }

  // docs/architecture/api.md POST /v1/commands의 "api가 먼저 막는 것"
  private async assertAllowed(kind: CommandKind, botId: number): Promise<void> {
    const bot = await this.bots.findById(botId);
    if (!bot) throw new BotNotFoundException(botId);
    const isBlocked =
      ((kind === 'pause' || kind === 'liquidate') &&
        bot.status === 'stopped') ||
      // 누적 손실 한도로 끝난 봇은 다시 돌리지 않아요 (POL-RISK-03)
      (kind === 'resume' && bot.statusReason === 'total_stop') ||
      (kind === 'rebudget' &&
        bot.status !== 'running' &&
        bot.status !== 'paused');
    if (isBlocked)
      throw new CommandNotAllowedException(
        kind,
        bot.statusReason ? `${bot.status}(${bot.statusReason})` : bot.status,
      );
  }
}
