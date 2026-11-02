import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketCalendar } from './entities/market-calendar.entity.js';
import { QuoteCache } from './entities/quote-cache.entity.js';
import { MarketCalendarRepository } from './market-calendar.repository.js';
import { MarketCalendarQueryService } from './market-calendar-query.service.js';
import { QuoteCacheRepository } from './quote-cache.repository.js';
import { QuoteQueryService } from './quote-query.service.js';

// engine이 저장한 장 일정·최근가를 읽기만 하는 모듈이에요. 토스(TossClient)가 필요 없어 api 프로세스도 가져와요
@Module({
  imports: [TypeOrmModule.forFeature([MarketCalendar, QuoteCache])],
  providers: [
    MarketCalendarQueryService,
    MarketCalendarRepository,
    QuoteQueryService,
    QuoteCacheRepository,
  ],
  exports: [MarketCalendarQueryService, QuoteQueryService],
})
export class MarketDataQueryModule {}
