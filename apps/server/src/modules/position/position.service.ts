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

@Injectable()
export class PositionService {
  private readonly logger = new Logger(PositionService.name);

  constructor(private readonly positions: PositionRepository) {}

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
