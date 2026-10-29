import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';

import { Decision } from './entities/decision.entity.js';

export type DecisionFields = Omit<
  Decision,
  'botVersion' | 'position' | 'createdAt'
>;

// decisions는 추가만 해요 (ADR-0003, DB 트리거가 UPDATE·DELETE를 막아요)
@Injectable()
export class DecisionRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get decisions(): Repository<Decision> {
    return this.txHost.tx.getRepository(Decision);
  }

  findEntry(positionId: number): Promise<Decision | null> {
    return this.decisions.findOne({
      where: { positionId, kind: 'enter' },
      order: { decidedAt: 'ASC' },
    });
  }

  async add(fields: DecisionFields): Promise<void> {
    await this.decisions.insert(fields);
  }
}
