import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull, Not, type Repository } from 'typeorm';

import type { BotStatus } from './bot.constants.js';
import { Bot } from './entities/bot.entity.js';
import { BotVersion } from './entities/bot-version.entity.js';

@Injectable()
export class BotRepository {
  // 1인용 서비스라 봇이 이보다 많지 않아요
  private static readonly MAX_BOTS = 1000;
  // 봇 하나의 버전 수 상한(조회 take 계산용)
  private static readonly MAX_VERSIONS_PER_BOT = 100;

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get bots(): Repository<Bot> {
    return this.txHost.tx.getRepository(Bot);
  }

  private get versions(): Repository<BotVersion> {
    return this.txHost.tx.getRepository(BotVersion);
  }

  // 선택 목록(필터)용 모든 봇. 끝난 봇도 내역 필터에 필요해요
  findAllNames(): Promise<Pick<Bot, 'id' | 'name'>[]> {
    return this.bots.find({
      select: { id: true, name: true },
      order: { id: 'ASC' },
      take: BotRepository.MAX_BOTS,
    });
  }

  // 같은 시각에 시작하는, 끝나지 않은 봇들의 투자금 설정과 시작 우선순위 (POL-FUND-03, 14)
  findStartingAt(
    tradingStart: string,
  ): Promise<
    Pick<Bot, 'id' | 'budgetType' | 'budgetRatio' | 'startPriority'>[]
  > {
    return this.bots.find({
      select: {
        id: true,
        budgetType: true,
        budgetRatio: true,
        startPriority: true,
      },
      where: { tradingStart, status: Not('stopped') },
      take: BotRepository.MAX_BOTS,
    });
  }

  // 봇과 첫 버전(initial)을 함께 저장해요. 호출하는 쪽 트랜잭션 안이에요
  async createWithVersion(
    bot: Omit<Bot, 'id' | 'createdAt' | 'updatedAt'>,
    version: Omit<
      BotVersion,
      'id' | 'botId' | 'bot' | 'version' | 'changeKind' | 'createdAt'
    >,
  ): Promise<Bot> {
    const saved = await this.bots.save(this.bots.create(bot));
    await this.versions.save(
      this.versions.create({
        ...version,
        botId: saved.id,
        version: 1,
        changeKind: 'initial',
      }),
    );
    return saved;
  }

  findByIds(ids: number[]): Promise<Bot[]> {
    return this.bots.find({
      where: { id: In(ids) },
      take: BotRepository.MAX_BOTS,
    });
  }

  // 봇들의 적용된 버전, 최신 버전이 앞이에요
  findAppliedVersions(botIds: number[]): Promise<BotVersion[]> {
    return this.versions.find({
      where: { botId: In(botIds), appliedAt: Not(IsNull()) },
      order: { botId: 'ASC', version: 'DESC' },
      take: BotRepository.MAX_BOTS * BotRepository.MAX_VERSIONS_PER_BOT,
    });
  }

  async updateBudget(
    id: number,
    budget: Pick<Bot, 'budgetType' | 'budgetRatio' | 'budgetAmount'>,
  ): Promise<void> {
    await this.bots.update({ id }, budget);
  }

  findById(id: number): Promise<Bot | null> {
    return this.bots.findOneBy({ id });
  }

  findByStatuses(statuses: BotStatus[]): Promise<Bot[]> {
    return this.bots.find({
      select: { id: true, status: true, statusReason: true, periodStart: true },
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
