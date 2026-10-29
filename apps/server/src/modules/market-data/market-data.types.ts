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

// MarketCollector가 받은 주문 이벤트를 넘길 곳(AccountSync). 웹소켓 수신을 막지 않게 짧게 처리해요
export interface OrderStreamHandlers {
  // personal:order 프레임의 data
  onOrder: (data: unknown) => void;
  // 다시 연결해 재선언한 뒤. 끊긴 동안의 주문 이벤트는 다시 오지 않아 재동기화가 필요해요
  onReconnected: () => void;
}
