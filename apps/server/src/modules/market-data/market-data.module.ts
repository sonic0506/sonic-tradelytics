import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketCalendar } from './entities/market-calendar.entity.js';
import { QuoteCache } from './entities/quote-cache.entity.js';
import { MarketCalendarRepository } from './market-calendar.repository.js';
import { MarketCalendarService } from './market-calendar.service.js';
import { MarketCollectorService } from './market-collector.service.js';
import { MarketScanService } from './market-scan.service.js';
import { QuoteCacheRepository } from './quote-cache.repository.js';

// engine 전용이에요. MarketCollector는 TossModule(engine 진입점에만 있음)에 기대요.
// api가 장 캘린더 조회를 쓰게 되면 그때 api용 모듈을 따로 나눠요.
@Module({
  imports: [TypeOrmModule.forFeature([QuoteCache, MarketCalendar])],
  providers: [
    MarketCollectorService,
    QuoteCacheRepository,
    MarketCalendarService,
    MarketCalendarRepository,
    MarketScanService,
  ],
  exports: [MarketCollectorService, MarketCalendarService, MarketScanService],
})
export class MarketDataModule {}
