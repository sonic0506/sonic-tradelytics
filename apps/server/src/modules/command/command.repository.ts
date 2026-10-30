import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { IsNull, type Repository } from 'typeorm';

import type { CommandKind, CommandResult } from './command.constants.js';
import { Command } from './entities/command.entity.js';

@Injectable()
export class CommandRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get commands(): Repository<Command> {
    return this.txHost.tx.getRepository(Command);
  }

  add(
    fields: Pick<
      Command,
      'kind' | 'botId' | 'liquidateAll' | 'budget' | 'requestedAt'
    >,
  ): Promise<Command> {
    return this.commands.save(this.commands.create(fields));
  }

  findById(id: number): Promise<Command | null> {
    return this.commands.findOneBy({ id });
  }

  // engine이 LISTEN command로 받아요. 트랜잭션 안에서 보내면 커밋할 때 전달돼요 (ADR-0004)
  async notify(): Promise<void> {
    await this.txHost.tx.query(`SELECT pg_notify('command', '')`);
  }

  // 미처리 명령을 요청 순서대로
  findPending(take: number): Promise<Command[]> {
    return this.commands.find({
      where: { handledAt: IsNull() },
      order: { requestedAt: 'ASC', id: 'ASC' },
      take,
    });
  }

  async markHandled(
    id: number,
    result: CommandResult,
    error: string | null,
  ): Promise<void> {
    await this.commands.update(
      { id },
      { handledAt: new Date(), result, error },
    );
  }

  async latestHandledAt(
    kind: CommandKind,
    result: CommandResult,
  ): Promise<Date | undefined> {
    const command = await this.commands.findOne({
      select: { id: true, handledAt: true },
      where: { kind, result },
      order: { handledAt: 'DESC' },
    });
    return command?.handledAt ?? undefined;
  }
}
