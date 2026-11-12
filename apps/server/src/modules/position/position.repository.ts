import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import {
  And,
  Brackets,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Or,
  type Repository,
} from 'typeorm';

import { BotDailyResult } from './entities/bot-daily-result.entity.js';
import { Position } from './entities/position.entity.js';
import type { PositionView } from './position.constants.js';
import type { HistoryFilter } from './position.types.js';

// 화면 상태 → 조건 (positionView와 같은 정의)
const VIEW_CONDITIONS: Record<PositionView, string> = {
  holding: "position.status = 'open' AND position.quantity > 0",
  pending: "position.status = 'open' AND position.quantity = 0",
  closed:
    "position.status = 'closed' AND position.exitReason IS DISTINCT FROM 'not_filled'",
  canceled: "position.status = 'closed' AND position.exitReason = 'not_filled'",
};

@Injectable()
export class PositionRepository {
  // ponytail: 봇들의 열린 포지션과 기준 시각 이후 포지션을 한 번에 읽어요. 거래가 아주 많아지면 SUM 쿼리로 바꿔요
  private static readonly MAX_FUND_ROWS = 10_000;

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get positions(): Repository<Position> {
    return this.txHost.tx.getRepository(Position);
  }

  // 자금 계산용: 봇들의 열린 포지션 + since 이후에 열린 포지션
  findForFunds(botIds: number[], since: Date): Promise<Position[]> {
    return this.positions.find({
      select: {
        id: true,
        botId: true,
        status: true,
        quantity: true,
        costBasis: true,
        realizedPnl: true,
        openedAt: true,
      },
      where: [
        { botId: In(botIds), status: 'open' },
        { botId: In(botIds), openedAt: MoreThanOrEqual(since) },
      ],
      take: PositionRepository.MAX_FUND_ROWS,
    });
  }

  // 오늘 손익용: 보유 중인 포지션과 since 이후에 연 포지션 (봇·직접 거래 모두)
  findHeldOrOpenedSince(since: Date): Promise<Position[]> {
    return this.positions.find({
      select: {
        id: true,
        botId: true,
        symbol: true,
        status: true,
        quantity: true,
        costBasis: true,
        realizedPnl: true,
        openedAt: true,
      },
      where: [
        { status: 'open', quantity: MoreThan(0) },
        { openedAt: MoreThanOrEqual(since) },
      ],
      take: PositionRepository.MAX_FUND_ROWS,
    });
  }

  // 투자 내역: 최신 진입순, 봇(이름·유형)을 같이 읽어요
  findHistory(
    filter: HistoryFilter,
    skip: number,
    take: number,
  ): Promise<[Position[], number]> {
    const query = this.positions
      .createQueryBuilder('position')
      .leftJoinAndSelect('position.bot', 'bot')
      .orderBy('position.openedAt', 'DESC')
      .addOrderBy('position.id', 'DESC');
    if (filter.start)
      query.andWhere('position.openedAt >= :start', { start: filter.start });
    if (filter.end)
      query.andWhere('position.openedAt < :end', { end: filter.end });
    const { botIds, includeManual } = filter;
    if (botIds?.length || includeManual)
      query.andWhere(
        new Brackets((owners) => {
          if (botIds?.length)
            owners.orWhere('position.botId IN (:...botIds)', { botIds });
          if (includeManual) owners.orWhere('position.botId IS NULL');
        }),
      );
    if (filter.symbol)
      query.andWhere('position.symbol = :symbol', { symbol: filter.symbol });
    if (filter.result === 'profit') query.andWhere('position.realizedPnl > 0');
    if (filter.result === 'loss') query.andWhere('position.realizedPnl < 0');
    if (filter.exitReasons?.length)
      query.andWhere('position.exitReason IN (:...exitReasons)', {
        exitReasons: filter.exitReasons,
      });
    const { views } = filter;
    if (views?.length)
      query.andWhere(
        new Brackets((conditions) => {
          for (const view of views) conditions.orWhere(VIEW_CONDITIONS[view]);
        }),
      );
    return query.skip(skip).take(take).getManyAndCount();
  }

  // 일일 집계용: 봇의 열린 포지션과 since 이후 닫힌 포지션
  findForDailyResults(since: Date): Promise<Position[]> {
    return this.positions.find({
      where: [
        { botId: Not(IsNull()), status: 'open' },
        { botId: Not(IsNull()), closedAt: MoreThanOrEqual(since) },
      ],
      take: PositionRepository.MAX_FUND_ROWS,
    });
  }

  // since 이후 청산된 봇 포지션의 순손익, 청산 순서대로 (상한 해제 기준). 한 주도 체결되지 않은 포지션은 빼요
  async findClosedPnlsSince(botId: number, since: Date): Promise<number[]> {
    const closed = await this.positions.find({
      select: { id: true, realizedPnl: true },
      where: {
        botId,
        status: 'closed',
        closedAt: MoreThanOrEqual(since),
        exitReason: Or(IsNull(), Not('not_filled')),
      },
      order: { closedAt: 'ASC', id: 'ASC' },
      take: PositionRepository.MAX_FUND_ROWS,
    });
    return closed.map(({ realizedPnl }) => realizedPnl);
  }

  // 일별 손익 화면용 (FR-PERF-03). 거래일 오름차순
  findDailyResults(filter: {
    botId?: number;
    from?: string;
    to?: string;
  }): Promise<BotDailyResult[]> {
    const range = [
      ...(filter.from ? [MoreThanOrEqual(filter.from)] : []),
      ...(filter.to ? [LessThanOrEqual(filter.to)] : []),
    ];
    return this.txHost.tx.getRepository(BotDailyResult).find({
      where: {
        ...(filter.botId === undefined ? {} : { botId: filter.botId }),
        ...(range.length ? { tradeDate: And(...range) } : {}),
      },
      order: { tradeDate: 'ASC', botId: 'ASC' },
      take: PositionRepository.MAX_FUND_ROWS,
    });
  }

  // 기간 안에 청산된 포지션(봇·직접 거래 모두). 한 주도 체결되지 않은 포지션은 빼요
  findClosedBetween(range: { start?: Date; end?: Date }): Promise<Position[]> {
    const closedAt = [
      ...(range.start ? [MoreThanOrEqual(range.start)] : []),
      ...(range.end ? [LessThan(range.end)] : []),
    ];
    return this.positions.find({
      select: {
        id: true,
        botId: true,
        realizedPnl: true,
        totalFees: true,
        openedAt: true,
        closedAt: true,
      },
      where: {
        status: 'closed',
        exitReason: Or(IsNull(), Not('not_filled')),
        ...(closedAt.length ? { closedAt: And(...closedAt) } : {}),
      },
      order: { closedAt: 'ASC', id: 'ASC' },
      take: PositionRepository.MAX_FUND_ROWS,
    });
  }

  // 같은 날 다시 돌리면 덮어써요
  async upsertDailyResults(
    rows: Omit<BotDailyResult, 'bot' | 'botVersion' | 'createdAt'>[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.txHost.tx
      .getRepository(BotDailyResult)
      .upsert(rows, ['botId', 'tradeDate']);
  }

  async addFees(id: number, fees: number): Promise<void> {
    await this.positions
      .createQueryBuilder()
      .update(Position)
      .set({
        realizedPnl: () => `"realized_pnl" - :fees`,
        totalFees: () => `"total_fees" + :fees`,
      })
      .where('id = :id', { id })
      .setParameter('fees', fees)
      .execute();
  }

  async setExitReason(
    id: number,
    exitReason: NonNullable<Position['exitReason']>,
  ): Promise<void> {
    await this.positions.update({ id, status: 'open' }, { exitReason });
  }

  // 봇의 보유 중인 포지션. botId가 없으면 모든 봇
  findHeldByBot(botId?: number): Promise<Position[]> {
    return this.positions.find({
      where: {
        botId: botId ?? Not(IsNull()),
        status: 'open',
        quantity: MoreThan(0),
      },
      take: PositionRepository.MAX_FUND_ROWS,
    });
  }

  // 봇의 열린 포지션. 진입 주문이 아직 체결되지 않은(수량 0) 포지션도 넣어요
  findOpenByBot(botId: number): Promise<Position[]> {
    return this.positions.find({
      where: { botId, status: 'open' },
      take: PositionRepository.MAX_FUND_ROWS,
    });
  }

  // since 이후 닫힌 봇 포지션의 종목 (재진입 대기)
  async findClosedSymbolsSince(botId: number, since: Date): Promise<string[]> {
    const closed = await this.positions.find({
      select: { id: true, symbol: true },
      where: { botId, status: 'closed', closedAt: MoreThan(since) },
      take: PositionRepository.MAX_FUND_ROWS,
    });
    return [...new Set(closed.map(({ symbol }) => symbol))];
  }

  // since 이후 닫힌 봇 포지션의 청산 사유. 최근이 앞이에요 (POL-RISK-04)
  async recentExitReasons(
    botId: number,
    since: Date,
    take: number,
  ): Promise<(string | null)[]> {
    const closed = await this.positions.find({
      select: { id: true, exitReason: true },
      // 체결 없이 끝난 진입은 거래가 아니에요. 세면 연속 손절이 끊겨요
      where: {
        botId,
        status: 'closed',
        closedAt: MoreThan(since),
        exitReason: Not('not_filled'),
      },
      order: { closedAt: 'DESC' },
      take,
    });
    return closed.map(({ exitReason }) => exitReason);
  }

  findWithBot(id: number): Promise<Position | null> {
    return this.positions.findOne({ where: { id }, relations: { bot: true } });
  }

  findById(id: number): Promise<Position | null> {
    return this.positions.findOneBy({ id });
  }

  // 종목마다 열린 직접 거래 포지션은 하나만 써요
  findOpenManual(symbol: string): Promise<Position | null> {
    return this.positions.findOne({
      where: { botId: IsNull(), symbol, status: 'open' },
      order: { id: 'ASC' },
    });
  }

  // 진입 판단과 함께 수량 0으로 만들어요 (주문 흐름: 포지션은 주문 전에 만들어요)
  createForBot(
    botId: number,
    symbol: string,
    openedAt: Date,
  ): Promise<Position> {
    return this.positions.save(
      this.positions.create({
        botId,
        symbol,
        status: 'open',
        quantity: 0,
        openedAt,
      }),
    );
  }

  async closeIfEmpty(
    id: number,
    exitReason: NonNullable<Position['exitReason']>,
    closedAt: Date,
  ): Promise<boolean> {
    const { affected } = await this.positions.update(
      { id, status: 'open', quantity: 0 },
      { status: 'closed', exitReason, closedAt },
    );
    return (affected ?? 0) > 0;
  }

  createManual(symbol: string, openedAt: Date): Promise<Position> {
    return this.positions.save(
      this.positions.create({
        botId: null,
        symbol,
        status: 'open',
        quantity: 0,
        openedAt,
      }),
    );
  }

  async update(
    id: number,
    fields: Pick<
      Position,
      | 'quantity'
      | 'costBasis'
      | 'realizedPnl'
      | 'totalFees'
      | 'status'
      | 'closedAt'
      | 'exitReason'
    >,
  ): Promise<void> {
    await this.positions.update({ id }, fields);
  }
}
