import type { EntryBanReason } from './risk.constants.js';

// 신규 진입 규칙 (docs/policy/risk-management.md 4, 4-1). 청산·손절 정리에는 쓰지 않아요.

const VI = new Set(['VI_STATIC', 'VI_DYNAMIC', 'VI_STATIC_AND_DYNAMIC']);
const MARKET_ALERT = new Set([
  'INVESTMENT_WARNING',
  'INVESTMENT_RISK',
  'OVERHEATED',
]);

// POL-RISK-06: 토스 매수 유의사항(warningType)과 종목 정보로 진입 금지 사유를 찾아요.
// 목록에 없는 유형(새 값, STOCK_WARRANTS 등)도 모르면 막아요
export function entryBanReason(stock: {
  warnings: string[];
  liquidationTrading: boolean;
  krxTradingSuspended: boolean;
  nxtTradingSuspended: boolean | null;
}): EntryBanReason | null {
  const { warnings } = stock;
  if (stock.krxTradingSuspended || stock.nxtTradingSuspended === true)
    return 'suspended';
  if (stock.liquidationTrading || warnings.includes('LIQUIDATION_TRADING'))
    return 'liquidation';
  if (warnings.some((warning) => VI.has(warning))) return 'vi';
  if (warnings.some((warning) => MARKET_ALERT.has(warning)))
    return 'market_alert';
  if (warnings.length > 0) return 'unknown_warning';
  return null;
}

// POL-RISK-15: 정규장(장 캘린더) 안이면서 봇 운영 시간 안일 때만 주문해요. 시각은 KST HH:mm:ss 문자열이에요
export function isTradingWindow(state: {
  isRegularSession: boolean;
  nowKst: string;
  botStart: string;
  botEnd: string;
}): boolean {
  return (
    state.isRegularSession &&
    state.botStart <= state.nowKst &&
    state.nowKst < state.botEnd
  );
}
