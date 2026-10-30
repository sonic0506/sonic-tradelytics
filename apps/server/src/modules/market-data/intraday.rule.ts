// 오늘 정규장 1분봉으로 시가와 VWAP를 구해요 (데이 트레이딩 판단 재료)

const TYPICAL_PRICE_PARTS = 3;

export interface MinuteCandle {
  // 봉 종료 시각. 시가 단일가(09:00)는 09:01 봉에 들어가요
  timestamp: Date;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
}

export interface IntradayStats {
  openPrice: number;
  vwap: number;
}

// 정규장(openAt < 봉 종료 ≤ closeAt) 봉만 써요. NXT 프리·애프터마켓 봉은 빼요. 거래가 없으면 null
export function intradayStats(
  candles: MinuteCandle[],
  session: { openAt: Date; closeAt: Date },
): IntradayStats | null {
  const regular = candles
    .filter(
      ({ timestamp }) =>
        timestamp > session.openAt && timestamp <= session.closeAt,
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const [first] = regular;
  const volume = regular.reduce((sum, candle) => sum + candle.volume, 0);
  if (!first || volume === 0) return null;
  const amount = regular.reduce(
    (sum, { highPrice, lowPrice, closePrice, volume: v }) =>
      sum + ((highPrice + lowPrice + closePrice) / TYPICAL_PRICE_PARTS) * v,
    0,
  );
  return { openPrice: first.openPrice, vwap: amount / volume };
}
