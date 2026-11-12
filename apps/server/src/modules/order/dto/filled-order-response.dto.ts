import { ApiProperty } from '@nestjs/swagger';

import { PageMetaDto } from '@/common/pagination/page.dto.js';

import type { BrokerOrder } from '../entities/broker-order.entity.js';
import {
  ORDER_ORIGINS,
  ORDER_SIDES,
  type OrderOrigin,
  type OrderSide,
} from '../order.constants.js';

// 체결된 주문 한 줄 (api.md GET /v1/orders)
export class FilledOrderResponseDto {
  id: string;

  /** 마지막 체결 시각 */
  filledAt: Date;

  symbolCode: string;

  /** 종목 이름을 아직 저장하지 않아 종목 코드예요 */
  symbolName: string;

  /** 직접 거래면 null */
  botName: string | null;

  @ApiProperty({ enum: ORDER_SIDES })
  side: OrderSide;

  filledQuantity: number;

  /** 평균 체결가 */
  avgFillPrice: number;

  @ApiProperty({ enum: ORDER_ORIGINS })
  origin: OrderOrigin;

  /** 투자 내역의 그 포지션 (GET /v1/positions/:id) */
  positionId: string;

  static from(order: BrokerOrder): FilledOrderResponseDto {
    const dto = new FilledOrderResponseDto();
    dto.id = String(order.id);
    dto.filledAt = order.filledAt ?? order.updatedAt;
    dto.symbolCode = order.symbol;
    // ponytail: 종목 이름을 저장하지 않아 코드를 줘요. 종목 마스터를 받으면 이름으로 바꿔요
    dto.symbolName = order.symbol;
    dto.botName = order.position.bot?.name ?? null;
    dto.side = order.side;
    dto.filledQuantity = order.filledQuantity;
    dto.avgFillPrice = order.avgFilledPrice ?? 0;
    dto.origin = order.origin;
    dto.positionId = String(order.positionId);
    return dto;
  }
}

export class FilledOrderPageDto {
  items: FilledOrderResponseDto[];
  meta: PageMetaDto;
}
