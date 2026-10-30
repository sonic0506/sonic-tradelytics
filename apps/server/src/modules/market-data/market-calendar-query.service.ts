import { Injectable } from '@nestjs/common';

import type { MarketCalendar } from './entities/market-calendar.entity.js';
import { MarketCalendarRepository } from './market-calendar.repository.js';

// 저장된 장 일정을 읽기만 해요. api 프로세스는 토스를 부르지 않아서 engine이 받아 둔 값을 써요 (ADR-0002)
@Injectable()
export class MarketCalendarQueryService {
  constructor(private readonly calendars: MarketCalendarRepository) {}

  // 그 거래일(YYYY-MM-DD) 일정. engine이 아직 받지 않았으면 null
  findDay(tradeDate: string): Promise<MarketCalendar | null> {
    return this.calendars.findByDate(tradeDate);
  }
}
