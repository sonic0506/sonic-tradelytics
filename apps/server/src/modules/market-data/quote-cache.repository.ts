import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';

import { QuoteCache } from './entities/quote-cache.entity.js';

@Injectable()
export class QuoteCacheRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get quotes(): Repository<QuoteCache> {
    return this.txHost.tx.getRepository(QuoteCache);
  }

  async upsert(
    rows: Pick<QuoteCache, 'symbol' | 'price' | 'receivedAt'>[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.quotes.upsert(rows, ['symbol']);
  }
}
