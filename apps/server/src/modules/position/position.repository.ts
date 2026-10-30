import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import {
  In,
  IsNull,
  MoreThan,
  MoreThanOrEqual,
  Not,
  type Repository,
} from 'typeorm';

import { Position } from './entities/position.entity.js';

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
      where: { botId, status: 'closed', closedAt: MoreThan(since) },
      order: { closedAt: 'DESC' },
      take,
    });
    return closed.map(({ exitReason }) => exitReason);
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
