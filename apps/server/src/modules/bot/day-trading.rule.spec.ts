import { DAY_TRADING_DEFAULTS } from './bot.constants.js';
import {
  type DayTradingMarket,
  entryPlan,
  evaluateEntry,
  evaluateExit,
} from './day-trading.rule.js';

describe('day-trading.rule', () => {
  const params = DAY_TRADING_DEFAULTS;
  // 시가 10,000 → 현재 10,300(+3%), VWAP 10,250 위 0.49%, 거래대금 5위
  const market: DayTradingMarket = {
    price: 10_300,
    openPrice: 10_000,
    vwap: 10_250,
    rank: 5,
  };
  const failedRules = (fields: Partial<DayTradingMarket>) =>
    evaluateEntry(params, { ...market, ...fields }).failed.map(
      ({ rule }) => rule,
    );

  describe('진입', () => {
    it('조건을 모두 충족하면 진입하고 점수는 100이에요', () => {
      const result = evaluateEntry(params, market);

      expect(result).toMatchObject({ isEntry: true, failed: [], score: 100 });
      expect(result.passed).toContainEqual({
        rule: 'rise_from_open_min',
        value: 3,
        threshold: 2,
      });
      expect(result.passed).toContainEqual({
        rule: 'vwap_band',
        value: 0.49,
        threshold: 1,
      });
    });

    it('경계값(순위 30위, 상승률 2%·10%, VWAP 바로 위·1% 안)은 충족이에요', () => {
      expect(failedRules({ rank: 30 })).toEqual([]);
      expect(failedRules({ price: 10_200, vwap: 10_200 })).toEqual([]);
      expect(failedRules({ price: 11_000, vwap: 10_892 })).toEqual([]);
    });

    it('하나라도 탈락하면 진입하지 않고 탈락 조건과 점수를 남겨요', () => {
      const result = evaluateEntry(params, { ...market, rank: 31 });

      expect(result).toMatchObject({
        isEntry: false,
        failed: [{ rule: 'trading_amount_rank', value: 31, threshold: 30 }],
        score: 86,
      });
    });

    it('상승률이 범위를 벗어나거나 VWAP 아래·너무 위면 탈락해요', () => {
      expect(failedRules({ price: 10_100, vwap: 10_050 })).toEqual([
        'rise_from_open_min',
      ]);
      expect(failedRules({ price: 11_100, vwap: 11_050 })).toEqual([
        'rise_from_open_max',
      ]);
      expect(failedRules({ vwap: 10_400 })).toEqual(['vwap_above']);
      expect(failedRules({ vwap: 10_150 })).toEqual(['vwap_band']);
    });

    it('주가가 범위 밖이면 탈락해요', () => {
      expect(failedRules({ price: 990, openPrice: 960, vwap: 985 })).toEqual([
        'price_min',
      ]);
      expect(
        failedRules({ price: 210_000, openPrice: 205_000, vwap: 209_000 }),
      ).toEqual(['price_max']);
    });
  });

  it('진입 예측은 마지막 익절 단계가 목표가, 손절은 2% 아래를 호가 단위로 내리고 청산 시각까지 분을 세요', () => {
    expect(entryPlan(params, 10_300, '10:00:00')).toEqual({
      targetPrice: 10_710,
      stopPrice: 10_090,
      horizonMinutes: 315,
    });
    expect(entryPlan(params, 10_300, '15:20:00').horizonMinutes).toBe(0);
  });

  describe('청산', () => {
    const held = {
      price: 10_000,
      vwap: 10_000,
      avgPrice: 10_000,
      takenSteps: 0,
      nowKst: '10:00:00',
    };

    it('조건이 없으면 보유해요', () => {
      expect(evaluateExit(params, held)).toEqual({ action: 'hold' });
    });

    it('15:15부터는 전량 청산해요', () => {
      expect(
        evaluateExit(params, { ...held, nowKst: '15:15:00' }),
      ).toMatchObject({ action: 'sell', reason: 'time_exit', ratio: 1 });
    });

    it('VWAP 아래로 0.5% 이상 내려가면 전량 청산해요', () => {
      expect(evaluateExit(params, { ...held, price: 9_960 })).toEqual({
        action: 'hold',
      });
      expect(evaluateExit(params, { ...held, price: 9_950 })).toEqual({
        action: 'sell',
        reason: 'vwap_break',
        ratio: 1,
        check: { rule: 'vwap_break', value: 0.5, threshold: 0.5 },
      });
    });

    it('+2%에 절반, +4%에 나머지를 팔아요', () => {
      const up = { ...held, vwap: 10_100 };
      expect(evaluateExit(params, { ...up, price: 10_190 })).toEqual({
        action: 'hold',
      });
      expect(evaluateExit(params, { ...up, price: 10_200 })).toEqual({
        action: 'sell',
        reason: 'take_profit',
        ratio: 0.5,
        check: { rule: 'take_profit_1', value: 2, threshold: 2 },
      });
      expect(
        evaluateExit(params, { ...up, price: 10_300, takenSteps: 1 }),
      ).toEqual({ action: 'hold' });
      expect(
        evaluateExit(params, { ...up, price: 10_400, takenSteps: 1 }),
      ).toMatchObject({ reason: 'take_profit', ratio: 1 });
    });
  });
});
