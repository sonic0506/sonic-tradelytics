import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';

import type { BatchResult } from './engine.constants.js';
import { BatchRun } from './entities/batch-run.entity.js';

export type BatchKey = Pick<BatchRun, 'job' | 'tradeDate' | 'slot'>;

@Injectable()
export class BatchRunRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get runs(): Repository<BatchRun> {
    return this.txHost.tx.getRepository(BatchRun);
  }

  find(key: BatchKey): Promise<BatchRun | null> {
    return this.runs.findOneBy(key);
  }

  // 실패한 배치를 다시 돌리면 같은 행을 새로 시작해요
  async start(key: BatchKey, startedAt: Date): Promise<void> {
    await this.runs.upsert(
      { ...key, startedAt, finishedAt: null, result: null, error: null },
      ['job', 'tradeDate', 'slot'],
    );
  }

  async finish(
    key: BatchKey,
    result: BatchResult,
    error: string | null,
  ): Promise<void> {
    await this.runs.update(key, { finishedAt: new Date(), result, error });
  }
}
