import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';

import { MarketCalendar } from './entities/market-calendar.entity.js';

@Injectable()
export class MarketCalendarRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get calendars(): Repository<MarketCalendar> {
    return this.txHost.tx.getRepository(MarketCalendar);
  }

  findByDate(tradeDate: string): Promise<MarketCalendar | null> {
    return this.calendars.findOneBy({ tradeDate });
  }

  async upsert(rows: Omit<MarketCalendar, 'createdAt'>[]): Promise<void> {
    await this.calendars.upsert(rows, ['tradeDate']);
  }
}
