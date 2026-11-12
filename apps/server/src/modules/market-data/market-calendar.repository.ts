import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Between, LessThanOrEqual, MoreThan, type Repository } from 'typeorm';

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

  // after 다음의 첫 개장일 (engine이 받아 둔 익일 영업일)
  findNextOpen(after: string): Promise<MarketCalendar | null> {
    return this.calendars.findOne({
      where: { tradeDate: MoreThan(after), isOpen: true },
      order: { tradeDate: 'ASC' },
    });
  }

  // from~to(둘 다 포함) 개장일 수
  countOpen(from: string, to: string): Promise<number> {
    return this.calendars.countBy({
      tradeDate: Between(from, to),
      isOpen: true,
    });
  }

  // until까지(포함) 최근 개장일, 최신이 앞이에요
  async findRecentOpen(until: string, take: number): Promise<string[]> {
    const days = await this.calendars.find({
      select: { tradeDate: true },
      where: { tradeDate: LessThanOrEqual(until), isOpen: true },
      order: { tradeDate: 'DESC' },
      take,
    });
    return days.map(({ tradeDate }) => tradeDate);
  }

  async upsert(rows: Omit<MarketCalendar, 'createdAt'>[]): Promise<void> {
    await this.calendars.upsert(rows, ['tradeDate']);
  }
}
