import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { QuoteCache } from './entities/quote-cache.entity.js';

// engine에는 요청 단위 트랜잭션(CLS)이 없어서 TypeORM Repository를 바로 받아요
@Injectable()
export class QuoteCacheRepository {
  constructor(
    @InjectRepository(QuoteCache)
    private readonly quotes: Repository<QuoteCache>,
  ) {}

  async upsert(
    rows: Pick<QuoteCache, 'symbol' | 'price' | 'receivedAt'>[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.quotes.upsert(rows, ['symbol']);
  }
}
