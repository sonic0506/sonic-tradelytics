import { ApiProperty } from '@nestjs/swagger';

export class BotPnlShareDto {
  /** 직접 거래면 null */
  botId: string | null;
  name: string;
  /** 실현 + 보유 중 평가 손익 */
  pnl: number;
}

// GET /v1/position-summaries. kind가 overall이면 전체 탭 필드, bot이면 봇 탭 필드만 와요
export class PositionSummaryDto {
  @ApiProperty({ enum: ['overall', 'bot'] })
  kind: 'overall' | 'bot';

  /** (overall) 보유 중 + 청산 완료 수 */
  tradeCount?: number;
  holdingCount?: number;
  closedCount?: number;
  /** (overall) 실현 손익 합(수수료·세금 차감) */
  netPnl?: number;
  /** (overall) 보유 중 평가 손익 합 */
  unrealizedPnl?: number;
  /** (overall) 수수료 합 */
  cost?: number;
  /** (overall) 세금 합 */
  tax?: number;
  botPnls?: BotPnlShareDto[];

  /** (bot) 확정 투자금. 확정 전이면 0 */
  budget?: number;
  /** (bot) 사용 중 금액 = 보유 매수 금액 + 미체결 매수 금액 */
  usedAmount?: number;
  remainingBudget?: number;
  /** (bot) 검증 구간이면 상한 금액, 아니면 null */
  capAmount?: number | null;
  /** (bot) 확정 이후 실현 + 보유분 평가 손익 */
  cumulativePnl?: number;
  /** (bot) cumulativePnl ÷ 확정 투자금, % */
  cumulativePnlRate?: number;
  /** (bot) 확정 이후 개장일 수 */
  tradingDays?: number;
  /** (bot) 누적 손실 한도까지 남은 금액 */
  lossStopRemaining?: number;
  /** (bot) 누적 손실 한도, % */
  lossLimitPercent?: number;
}
