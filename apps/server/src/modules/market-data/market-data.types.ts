export interface OrderbookLevel {
  price: number;
  volume: number;
}

// 종목 하나의 최근 시세. 봇은 읽기만 해요(docs/architecture/engine.md 시세 스냅샷)
export interface MarketSnapshot {
  // 최근 체결가. 호가만 받은 종목은 아직 없어요
  price?: number;
  // 최근 체결 한 건의 수량
  volume?: number;
  // 호가 전체 스냅샷. 1호가가 맨 앞이에요
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
  // 마지막 수신 시각(epoch ms). 웹소켓 프레임이나 REST 보정 때 바뀌어요
  receivedAt: number;
}
