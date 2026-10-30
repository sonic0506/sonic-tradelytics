import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';

import { EngineStatus } from './entities/engine-status.entity.js';

export type EngineStatusFields = Omit<EngineStatus, 'id' | 'createdAt'>;

@Injectable()
export class EngineStatusRepository {
  // engine_statuses는 한 행이에요 (CHECK id = 1)
  private static readonly ROW_ID = 1;

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get statuses(): Repository<EngineStatus> {
    return this.txHost.tx.getRepository(EngineStatus);
  }

  findCurrent(): Promise<EngineStatus | null> {
    return this.statuses.findOneBy({ id: EngineStatusRepository.ROW_ID });
  }

  async save(fields: EngineStatusFields): Promise<void> {
    await this.statuses.upsert(
      { id: EngineStatusRepository.ROW_ID, ...fields },
      ['id'],
    );
  }
}
