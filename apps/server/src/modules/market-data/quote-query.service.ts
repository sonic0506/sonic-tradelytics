import { Injectable } from '@nestjs/common';

import type { QuoteCache } from './entities/quote-cache.entity.js';
import { QuoteCacheRepository } from './quote-cache.repository.js';

// 보유 종목의 최근가 (engine이 5초마다 quote_caches에 써요)
@Injectable()
export class QuoteQueryService {
  constructor(private readonly quotes: QuoteCacheRepository) {}

  // 종목 → 최근 체결가. 아직 없는 종목은 빠져요
  async pricesOf(symbols: string[]): Promise<Map<string, number>> {
    if (symbols.length === 0) return new Map();
    const quotes = await this.quotes.findBySymbols(symbols);
    return new Map(quotes.map(({ symbol, price }) => [symbol, price]));
  }

  // 종목 → 최근가와 받은 시각 (평가 손익의 가격 기준 시각). 아직 없는 종목은 빠져요
  async quotesOf(symbols: string[]): Promise<Map<string, QuoteCache>> {
    if (symbols.length === 0) return new Map();
    const quotes = await this.quotes.findBySymbols(symbols);
    return new Map(quotes.map((quote) => [quote.symbol, quote]));
  }
}
