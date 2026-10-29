import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, Not, type Repository } from 'typeorm';

import type { BotStatus } from './bot.constants.js';
import { Bot } from './entities/bot.entity.js';

@Injectable()
export class BotRepository {
  // 1인용 서비스라 봇이 이보다 많지 않아요
  private static readonly MAX_BOTS = 1000;

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get bots(): Repository<Bot> {
    return this.txHost.tx.getRepository(Bot);
  }

  findById(id: number): Promise<Bot | null> {
    return this.bots.findOneBy({ id });
  }

  findByStatuses(statuses: BotStatus[]): Promise<Bot[]> {
    return this.bots.find({
      select: { id: true, status: true, statusReason: true },
      where: { status: In(statuses) },
      take: BotRepository.MAX_BOTS,
    });
  }

  async setStatus(
    id: number,
    status: BotStatus,
    statusReason: string | null,
  ): Promise<void> {
    await this.bots.update({ id }, { status, statusReason });
  }

  // 이미 멈춘 봇은 그대로 둬요(먼저 있던 사유를 덮지 않아요)
  async stopAll(statusReason: string): Promise<void> {
    await this.bots.update(
      { status: Not('stopped') },
      { status: 'stopped', statusReason },
    );
  }
}
