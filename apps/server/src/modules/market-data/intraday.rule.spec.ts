import { intradayStats, type MinuteCandle } from './intraday.rule.js';

describe('intraday.rule', () => {
  const session = {
    openAt: new Date('2026-10-30T09:00:00+09:00'),
    closeAt: new Date('2026-10-30T15:30:00+09:00'),
  };
  const candle = (
    time: string,
    price: number,
    volume: number,
  ): MinuteCandle => ({
    timestamp: new Date(`2026-10-30T${time}:00+09:00`),
    openPrice: price,
    highPrice: price,
    lowPrice: price,
    closePrice: price,
    volume,
  });

  it('시가는 09:01 봉의 시가, VWAP는 대표가(고·저·종 평균) 거래량 가중 평균이에요', () => {
    const stats = intradayStats(
      [
        // 최신 봉이 앞이에요 (토스 응답 순서)
        candle('09:03', 10_400, 100),
        {
          ...candle('09:02', 10_200, 300),
          highPrice: 10_300,
          lowPrice: 10_100,
        },
        { ...candle('09:01', 10_100, 600), openPrice: 10_000 },
      ],
      session,
    );

    expect(stats).toEqual({ openPrice: 10_000, vwap: 10_160 });
  });

  it('정규장 밖(NXT 프리·애프터마켓) 봉은 빼요', () => {
    const stats = intradayStats(
      [
        candle('15:31', 99_000, 1_000),
        candle('15:30', 10_000, 10),
        candle('09:01', 10_000, 10),
        candle('09:00', 50_000, 1_000),
        candle('08:30', 50_000, 1_000),
      ],
      session,
    );

    expect(stats).toEqual({ openPrice: 10_000, vwap: 10_000 });
  });

  it('정규장 봉이 없거나 거래가 없으면 null이에요', () => {
    expect(intradayStats([candle('08:59', 10_000, 10)], session)).toBeNull();
    expect(intradayStats([candle('09:01', 10_000, 0)], session)).toBeNull();
  });
});
