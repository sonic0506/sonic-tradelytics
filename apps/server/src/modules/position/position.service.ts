import { Injectable, Logger } from '@nestjs/common';

import type { Position } from './entities/position.entity.js';
import { PositionNotFoundException } from './position.exception.js';
import { PositionRepository } from './position.repository.js';

// 주문 하나에서 새로 늘어난 체결분
export interface Fill {
  side: 'BUY' | 'SELL';
  quantity: number;
  amount: number;
  // 수수료 + 세금
  fees: number;
  at: Date;
}

// 봇 하나의 보유·실현 손익 (POL-FUND-02, 05)
export interface BotHoldings {
  // 열린 포지션의 매수 금액 합
  holdingsCost: number;
  // since 이후에 연 포지션의 실현 손익 합(수수료·세금 차감)
  realizedPnl: number;
  hasHoldings: boolean;
}

@Injectable()
export class PositionService {
  private readonly logger = new Logger(PositionService.name);

  constructor(private readonly positions: PositionRepository) {}

  // 봇마다 since(그 배분의 확정 시각) 이후 실현 손익과 지금 보유분을 모아요
  async botHoldings(
    bots: { botId: number; since: Date }[],
  ): Promise<Map<number, BotHoldings>> {
    const result = new Map<number, BotHoldings>(
      bots.map(({ botId }) => [
        botId,
        { holdingsCost: 0, realizedPnl: 0, hasHoldings: false },
      ]),
    );
    if (bots.length === 0) return result;
    const sinceByBot = new Map(bots.map(({ botId, since }) => [botId, since]));
    const earliest = new Date(
      Math.min(...bots.map(({ since }) => since.getTime())),
    );
    const positions = await this.positions.findForFunds(
      bots.map(({ botId }) => botId),
      earliest,
    );
    for (const position of positions) {
      const holdings =
        position.botId === null ? undefined : result.get(position.botId);
      const since =
        position.botId === null ? undefined : sinceByBot.get(position.botId);
      if (!holdings || !since) continue;
      if (position.status === 'open') {
        holdings.holdingsCost += position.costBasis;
        holdings.hasHoldings ||= position.quantity > 0;
      }
      if (position.openedAt >= since)
        holdings.realizedPnl += position.realizedPnl;
    }
    return result;
  }

  findHeldByBot(botId?: number): Promise<Position[]> {
    return this.positions.findHeldByBot(botId);
  }

  find(positionId: number): Promise<Position | null> {
    return this.positions.findById(positionId);
  }

  // 청산을 시작할 때 사유를 먼저 적어 둬요. 수량이 0이 되어 닫힐 때 그대로 남아요
  setExitReason(
    positionId: number,
    exitReason: NonNullable<Position['exitReason']>,
  ): Promise<void> {
    return this.positions.setExitReason(positionId, exitReason);
  }

  // 수량이 0인 봇 포지션을 사유와 함께 닫아요. 닫았으면 true
  closeFlat(
    positionId: number,
    exitReason: NonNullable<Position['exitReason']>,
    closedAt: Date,
  ): Promise<boolean> {
    return this.positions.closeIfEmpty(positionId, exitReason, closedAt);
  }

  // 진입 판단의 포지션 (수량 0에서 시작)
  openForBot(botId: number, symbol: string, openedAt: Date): Promise<Position> {
    return this.positions.createForBot(botId, symbol, openedAt);
  }

  // 한 주도 체결되지 않고 끝난 포지션을 닫아요 (F2 "취소"). 체결이 있으면 그대로 두고 false예요
  closeNotFilled(positionId: number, closedAt: Date): Promise<boolean> {
    return this.positions.closeIfEmpty(positionId, 'not_filled', closedAt);
  }

  // 직접 거래 주문을 붙일 포지션 (FR-MAN-01). 같은 종목에 열린 것이 있으면 그걸 써요
  async openManual(symbol: string, openedAt: Date): Promise<Position> {
    return (
      (await this.positions.findOpenManual(symbol)) ??
      this.positions.createManual(symbol, openedAt)
    );
  }

  // 체결분을 수량·매수 금액·실현 손익에 반영해요. 수수료·세금은 체결 때마다 실현 손익에서 빼요 (NFR-05).
  // 봇 포지션은 수량이 0이 돼도 여기서 닫지 않아요. 잠금 해제·채점이 함께인 청산 순서가 닫아요
  async applyFill(positionId: number, fill: Fill): Promise<void> {
    const position = await this.positions.findById(positionId);
    if (!position) throw new PositionNotFoundException(positionId);

    let { quantity, costBasis, realizedPnl } = position;
    if (fill.side === 'BUY') {
      quantity += fill.quantity;
      costBasis += fill.amount;
    } else {
      // ponytail: 서비스 시작 전부터 가진 주식을 직접 팔면 매수 금액을 몰라 0원으로 봐요. 과거 주문 가져오기(FR-MAN-06) 때 고쳐요
      const sold = Math.min(fill.quantity, quantity);
      if (sold < fill.quantity)
        this.logger.warn(
          `position ${positionId}: 보유 ${quantity}주보다 많이 팔렸어요 (${fill.quantity}주)`,
        );
      const soldCost =
        quantity === 0 ? 0 : Math.round((costBasis * sold) / quantity);
      quantity -= sold;
      costBasis -= soldCost;
      realizedPnl += fill.amount - soldCost;
    }
    realizedPnl -= fill.fees;

    const isManualClosed = position.botId === null && quantity === 0;
    await this.positions.update(positionId, {
      quantity,
      costBasis,
      realizedPnl,
      totalFees: position.totalFees + fill.fees,
      status: isManualClosed ? 'closed' : position.status,
      closedAt: isManualClosed ? fill.at : position.closedAt,
      exitReason: isManualClosed ? 'manual' : position.exitReason,
    });
  }
}
