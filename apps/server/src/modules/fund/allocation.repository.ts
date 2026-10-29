import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { IsNull, type Repository } from 'typeorm';

import { Allocation } from './entities/allocation.entity.js';

@Injectable()
export class AllocationRepository {
  // 1인용 서비스라 살아 있는 배분(=실행 중인 봇)은 이보다 많지 않아요
  private static readonly MAX_ACTIVE = 1000;

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get allocations(): Repository<Allocation> {
    return this.txHost.tx.getRepository(Allocation);
  }

  // 반환되지 않은 배분 (봇당 1개)
  findActive(): Promise<Allocation[]> {
    return this.allocations.find({
      where: { releasedAt: IsNull() },
      take: AllocationRepository.MAX_ACTIVE,
    });
  }

  findActiveByBot(botId: number): Promise<Allocation | null> {
    return this.allocations.findOneBy({ botId, releasedAt: IsNull() });
  }

  async add(
    rows: Pick<Allocation, 'botId' | 'snapshotId' | 'amount' | 'capped'>[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.allocations.save(
      rows.map((row) => this.allocations.create(row)),
    );
  }

  async release(
    id: number,
    releasedAmount: number,
    releasedAt: Date,
  ): Promise<void> {
    await this.allocations.update(
      { id, releasedAt: IsNull() },
      { releasedAt, releasedAmount },
    );
  }
}
