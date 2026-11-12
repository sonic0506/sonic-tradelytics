import type {
  ExitReason,
  PositionResult,
  PositionView,
} from './position.constants.js';

// 투자 내역 필터 (api.md GET /v1/positions). 진입 시각 기준이에요
export interface HistoryFilter {
  start?: Date;
  end?: Date;
  // 봇 id. includeManual이면 직접 거래도 넣어요. 둘 다 없으면 전체
  botIds?: number[];
  includeManual?: boolean;
  symbol?: string;
  // 실현 손익 기준
  result?: PositionResult;
  views?: PositionView[];
  exitReasons?: ExitReason[];
}
