import { ApiProperty } from '@nestjs/swagger';

import { PageMetaDto } from '@/common/pagination/page.dto.js';
import { BOT_TYPES, type BotType } from '@/modules/bot/index.js';
import type { QuoteCache } from '@/modules/market-data/index.js';
import type { FillTotals } from '@/modules/order/index.js';
import {
  EXIT_REASONS,
  type ExitReason,
  type Position,
  POSITION_VIEWS,
  type PositionView,
  positionView,
} from '@/modules/position/index.js';

const PERCENT = 100;
const PRECISION = 100;
const pct = (value: number, base: number): number =>
  base ? Math.round((value / base) * PERCENT * PRECISION) / PRECISION : 0;
const average = (amount: number, quantity: number): number =>
  quantity ? Math.round(amount / quantity) : 0;

// 투자 내역 한 줄 = 포지션 하나 (FR-PERF-04). 보유 중이면 평가 값이 차요
export class PositionRowResponseDto {
  id: string;

  /** 진입 시각 */
  enteredAt: Date;

  /** 청산 시각. 열려 있으면 null */
  exitedAt: Date | null;

  /** 직접 거래면 null (FR-PERF-07) */
  botId: string | null;

  botName: string | null;

  @ApiProperty({ enum: BOT_TYPES, nullable: true })
  botType: BotType | null;

  symbolCode: string;

  /** 종목 이름을 아직 저장하지 않아 종목 코드예요 */
  symbolName: string;

  /** 보유 중이면 지금 수량, 아니면 산 수량 */
  quantity: number;

  /** 평균 매수 체결가. 체결이 없으면 0 */
  entryPrice: number;

  /** 평균 매도 체결가. 판 적이 없으면 null */
  exitPrice: number | null;

  /** 보유분 평균 매수가 (보유 중이 아니면 entryPrice) */
  avgPrice: number;

  /** 보유 중이면 평가에 쓴 최근가. 최근가를 모르거나 보유 중이 아니면 null */
  currentPrice: number | null;

  /** 보유 중 평가금액 */
  evaluationAmount: number | null;

  /** 보유 중 평가 손익 */
  unrealizedPnl: number | null;

  /** 보유 중 평가 손익 ÷ 보유분 매수 금액, % */
  unrealizedPnlRate: number | null;

  /** 실현 손익(수수료·세금 차감) + 보유 중 평가 손익 */
  netPnl: number;

  /** netPnl ÷ 매수 체결 금액, % */
  netPnlRate: number;

  @ApiProperty({ enum: POSITION_VIEWS })
  status: PositionView;

  @ApiProperty({ enum: EXIT_REASONS, nullable: true })
  exitReason: ExitReason | null;

  /** 평가 가격을 받은 시각. 보유 중이 아니거나 최근가를 모르면 null */
  quotedAt: Date | null;

  static from(
    position: Position,
    totals: FillTotals | undefined,
    quote: QuoteCache | undefined,
  ): PositionRowResponseDto {
    const view = positionView(position);
    const isHolding = view === 'holding';
    const buyAmount = totals?.buyAmount ?? 0;
    const entryPrice = average(buyAmount, totals?.buyQuantity ?? 0);
    const priced = isHolding ? quote : undefined;
    const evaluation = priced ? priced.price * position.quantity : null;
    const unrealized =
      evaluation === null ? null : evaluation - position.costBasis;
    const netPnl = position.realizedPnl + (unrealized ?? 0);

    const dto = new PositionRowResponseDto();
    dto.id = String(position.id);
    dto.enteredAt = position.openedAt;
    dto.exitedAt = position.closedAt;
    dto.botId = position.botId === null ? null : String(position.botId);
    dto.botName = position.bot?.name ?? null;
    dto.botType = position.bot?.type ?? null;
    dto.symbolCode = position.symbol;
    // ponytail: 종목 이름을 저장하지 않아 코드를 줘요. 종목 마스터를 받으면 이름으로 바꿔요
    dto.symbolName = position.symbol;
    dto.quantity = isHolding ? position.quantity : (totals?.buyQuantity ?? 0);
    dto.entryPrice = entryPrice;
    dto.exitPrice = totals?.sellQuantity
      ? average(totals.sellAmount, totals.sellQuantity)
      : null;
    dto.avgPrice = isHolding
      ? average(position.costBasis, position.quantity)
      : entryPrice;
    dto.currentPrice = priced?.price ?? null;
    dto.evaluationAmount = evaluation;
    dto.unrealizedPnl = unrealized;
    dto.unrealizedPnlRate =
      unrealized === null ? null : pct(unrealized, position.costBasis);
    dto.netPnl = netPnl;
    dto.netPnlRate = pct(netPnl, buyAmount);
    dto.status = view;
    dto.exitReason = position.exitReason;
    dto.quotedAt = priced?.receivedAt ?? null;
    return dto;
  }
}

export class PositionHistoryDto {
  items: PositionRowResponseDto[];
  meta: PageMetaDto;

  /** 보유 중 평가에 쓴 가장 늦은 가격 시각. 보유 중이 없으면 null */
  quotedAt: Date | null;
}
