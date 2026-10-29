import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

import { EngineLock } from '@/infra/database/engine-lock.js';
import { BotService } from '@/modules/bot/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { FundService } from '@/modules/fund/index.js';
import { RiskService } from '@/modules/risk/index.js';

import type { CommandResult } from './command.constants.js';
import { CommandRepository } from './command.repository.js';
import type { Command } from './entities/command.entity.js';

interface Outcome {
  result: CommandResult;
  error: string | null;
}
const OK: Outcome = { result: 'ok', error: null };
const failed = (error: string): Outcome => ({ result: 'failed', error });

// 손실 한도 정지는 resume으로 풀지 않아요 (하루 한도는 다음 거래일 자동)
const LOSS_LIMIT_REASONS = new Set(['daily_stop', 'total_stop']);

// api가 commands에 넣은 명령을 처리해요 (ADR-0004, docs/architecture/engine.md 명령 처리).
// NOTIFY는 깨우는 신호로만 쓰고 처리할 내용은 항상 테이블에서 읽어요. 같은 명령을 두 번 처리해도 결과가 같아요.
@Injectable()
export class CommandService {
  // NOTIFY를 놓쳤을 때 보완하는 재조회 주기
  private static readonly POLL_MS = 5000;
  private static readonly BATCH = 100;

  private readonly logger = new Logger(CommandService.name);
  private timer: NodeJS.Timeout | undefined;
  private draining: Promise<void> | undefined;
  private hasMore = false;

  constructor(
    private readonly lock: EngineLock,
    private readonly commands: CommandRepository,
    private readonly engineState: EngineStateService,
    private readonly bots: BotService,
    private readonly risk: RiskService,
    private readonly fund: FundService,
  ) {}

  // engine 시작 순서 4번: bots.status와 risk_events로 정지 상태를 다시 채워요
  async restore(): Promise<void> {
    for (const bot of await this.bots.findInactive())
      this.engineState.blockBot(bot.id, bot.statusReason ?? bot.status);
    // 킬 스위치는 그 뒤에 봇을 다시 시작(resume 성공)할 때까지 유지해요
    const killedAt = await this.risk.latestAt('kill_switch');
    const resumedAt = await this.commands.latestHandledAt('resume', 'ok');
    if (killedAt && (!resumedAt || killedAt > resumedAt))
      this.engineState.halt('kill');
  }

  // engine 시작 순서 8번: LISTEN command, 미처리 명령 처리. 실패하면 던져요(시작 실패)
  async start(): Promise<void> {
    await this.lock.listenCommands(() => {
      this.wake();
    });
    await this.drain();
    this.timer = setInterval(() => {
      this.wake();
    }, CommandService.POLL_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private wake(): void {
    this.drain().catch((error: unknown) => {
      this.logger.error(`명령 처리 실패: ${String(error)}`);
    });
  }

  // 처리 중에 또 깨우면 끝난 뒤 한 번 더 읽어요. 같은 명령을 동시에 두 번 처리하지 않아요
  private drain(): Promise<void> {
    if (this.draining) {
      this.hasMore = true;
      return this.draining;
    }
    this.draining = this.handlePending().finally(() => {
      this.draining = undefined;
      if (this.hasMore) {
        this.hasMore = false;
        this.wake();
      }
    });
    return this.draining;
  }

  private async handlePending(): Promise<void> {
    const pending = await this.commands.findPending(CommandService.BATCH);
    if (pending.length === CommandService.BATCH) this.hasMore = true;
    // 요청 순서대로 하나씩 (kill 뒤의 resume처럼 순서가 결과를 바꿔요)
    await pending.reduce<Promise<void>>(
      (previous, command) => previous.then(() => this.handle(command)),
      Promise.resolve(),
    );
  }

  private async handle(command: Command): Promise<void> {
    // 신규 진입 차단은 DB보다 먼저 메모리에 걸어요. 1초 기준은 "신규 주문이 더 나가지 않는 것"이에요 (NFR-02)
    if (command.kind === 'kill') this.engineState.halt('kill');
    if (
      command.botId !== null &&
      (command.kind === 'pause' || command.kind === 'liquidate')
    )
      this.engineState.blockBot(command.botId, command.kind);

    try {
      // rebudget은 토스 스냅샷을 찍어서 명령 트랜잭션 밖에서 해요. 배분은 FundService가 한 트랜잭션으로 바꿔요
      const outcome =
        command.kind === 'rebudget'
          ? await this.rebudget(command)
          : await this.apply(command);
      if (
        command.kind === 'resume' &&
        command.botId !== null &&
        outcome.result === 'ok'
      ) {
        this.engineState.unblockBot(command.botId);
        this.engineState.release('kill');
      }
    } catch (error) {
      this.logger.error(
        `명령 ${command.id}(${command.kind}) 실패: ${String(error)}`,
      );
      await this.commands.markHandled(command.id, 'failed', String(error));
    }
  }

  // 봇 상태·리스크 기록·처리 결과를 함께 남겨요
  @Transactional()
  private async apply(command: Command): Promise<Outcome> {
    const outcome = await this.run(command);
    await this.commands.markHandled(command.id, outcome.result, outcome.error);
    return outcome;
  }

  // POL-FUND-12: 쉬는 중이 아니거나 돈이 모자라면 failed로 남기고 기존 투자금을 그대로 둬요
  private async rebudget(command: Command): Promise<Outcome> {
    const result =
      command.botId === null
        ? { ok: false as const, error: 'BOT_NOT_FOUND' }
        : await this.fund.rebudget(command.botId, command.budget);
    const outcome = result.ok ? OK : failed(result.error);
    await this.commands.markHandled(command.id, outcome.result, outcome.error);
    return outcome;
  }

  private async run(command: Command): Promise<Outcome> {
    if (command.kind === 'kill') {
      await this.bots.stopAll('kill_switch');
      await this.risk.record('kill_switch', null, {
        commandId: command.id,
        liquidateAll: command.liquidateAll,
      });
      // ponytail: 미체결 취소·전량 청산은 주문 흐름(OrderService 주문·취소)을 만들 때 붙여요
      return command.liquidateAll
        ? failed('모든 봇을 멈췄지만 전량 청산은 아직 하지 못해요')
        : OK;
    }
    const bot =
      command.botId === null ? null : await this.bots.findById(command.botId);
    if (!bot) return failed('봇을 찾을 수 없어요');

    switch (command.kind) {
      case 'pause':
        await this.bots.setStatus(bot.id, 'paused', 'pause');
        return OK;
      case 'liquidate':
        await this.bots.setStatus(bot.id, 'stopped', 'liquidate');
        return failed('봇을 멈췄지만 청산은 아직 하지 못해요');
      case 'resume':
        if (bot.statusReason && LOSS_LIMIT_REASONS.has(bot.statusReason))
          return failed('손실 한도로 멈춘 봇은 다시 시작할 수 없어요');
        await this.bots.setStatus(bot.id, 'running', null);
        return OK;
      // handle()이 먼저 rebudget()으로 보내서 여기에는 오지 않아요
      case 'rebudget':
        return this.rebudget(command);
    }
  }
}
