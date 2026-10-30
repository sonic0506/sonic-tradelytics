import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketCalendar } from './entities/market-calendar.entity.js';
import { MarketCalendarRepository } from './market-calendar.repository.js';
import { MarketCalendarQueryService } from './market-calendar-query.service.js';

// 장 일정 읽기만 하는 모듈이에요. 토스(TossClient)가 필요 없어 api 프로세스도 가져와요
@Module({
  imports: [TypeOrmModule.forFeature([MarketCalendar])],
  providers: [MarketCalendarQueryService, MarketCalendarRepository],
  exports: [MarketCalendarQueryService],
})
export class MarketCalendarQueryModule {}
