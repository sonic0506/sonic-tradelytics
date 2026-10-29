import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';

import { AccountSnapshot } from './entities/account-snapshot.entity.js';

@Injectable()
export class AccountSnapshotRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get snapshots(): Repository<AccountSnapshot> {
    return this.txHost.tx.getRepository(AccountSnapshot);
  }

  // 운용 자산(available_capital)은 DB가 계산해서, 저장한 뒤 다시 읽어 돌려줘요
  async add(
    fields: Pick<
      AccountSnapshot,
      'takenAt' | 'orderableCash' | 'runningBotsCashShare'
    >,
  ): Promise<AccountSnapshot> {
    const { id } = await this.snapshots.save(this.snapshots.create(fields));
    return this.snapshots.findOneByOrFail({ id });
  }
}
