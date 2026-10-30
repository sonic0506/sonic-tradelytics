import { tickSize } from '@/common/market/tick-size.js';

import { isStopTriggered, paperCosts, paperFillPrice } from './paper.rule.js';

describe('paper.rule', () => {
  const quote = { bestAsk: 70_100, bestBid: 70_000, lastPrice: 70_000 };

  it('호가 단위는 가격 구간마다 달라요', () => {
    expect(tickSize(1_999)).toBe(1);
    expect(tickSize(2_000)).toBe(5);
    expect(tickSize(49_950)).toBe(50);
    expect(tickSize(70_000)).toBe(100);
    expect(tickSize(500_000)).toBe(1_000);
  });

  it('시장가는 상대 1호가에서 1틱 불리하게 체결돼요', () => {
    expect(
      paperFillPrice({ side: 'BUY', orderType: 'MARKET', price: null }, quote),
    ).toBe(70_200);
    expect(
      paperFillPrice({ side: 'SELL', orderType: 'MARKET', price: null }, quote),
    ).toBe(69_900);
  });

  it('지정가는 상대 1호가가 닿을 때만 그 호가로 체결돼요', () => {
    expect(
      paperFillPrice({ side: 'BUY', orderType: 'LIMIT', price: 70_000 }, quote),
    ).toBeNull();
    expect(
      paperFillPrice({ side: 'BUY', orderType: 'LIMIT', price: 70_500 }, quote),
    ).toBe(70_100);
    expect(
      paperFillPrice(
        { side: 'SELL', orderType: 'LIMIT', price: 69_000 },
        quote,
      ),
    ).toBe(70_000);
  });

  it('호가가 없으면 최근 체결가로, 시세가 없으면 체결하지 않아요', () => {
    const lastOnly = { bestAsk: null, bestBid: null, lastPrice: 10_000 };
    expect(
      paperFillPrice(
        { side: 'BUY', orderType: 'MARKET', price: null },
        lastOnly,
      ),
    ).toBe(10_010);
    expect(
      paperFillPrice(
        { side: 'BUY', orderType: 'MARKET', price: null },
        { ...lastOnly, lastPrice: null },
      ),
    ).toBeNull();
  });

  it('수수료는 양쪽, 세금은 매도에만 붙고 원 미만은 버려요', () => {
    const rates = { commissionRate: 0.00015, taxRate: 0.002 };
    expect(paperCosts('BUY', 210_300, rates)).toEqual({
      commission: 31,
      tax: 0,
    });
    expect(paperCosts('SELL', 210_300, rates)).toEqual({
      commission: 31,
      tax: 420,
    });
  });

  it('손절은 최근 체결가가 발동가 이하일 때 발동해요', () => {
    expect(isStopTriggered(68_000, 68_000)).toBe(true);
    expect(isStopTriggered(68_000, 68_100)).toBe(false);
    expect(isStopTriggered(68_000, undefined)).toBe(false);
  });
});
