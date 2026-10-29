import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { IsNull, type Repository } from 'typeorm';

import { Position } from './entities/position.entity.js';

@Injectable()
export class PositionRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get positions(): Repository<Position> {
    return this.txHost.tx.getRepository(Position);
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
