import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PageDto } from '@/common/pagination/page.dto.js';

import { FilledOrderQueryDto } from './dto/filled-order-query.dto.js';
import {
  FilledOrderPageDto,
  FilledOrderResponseDto,
} from './dto/filled-order-response.dto.js';
import { OrderQueryService } from './order-query.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orders: OrderQueryService) {}

  /** 체결된 주문 (FR-PERF-01, 04). 마지막 체결 시각 최신순, 기본으로 직접 거래는 빼요 */
  @Get()
  async findPage(
    @Query() query: FilledOrderQueryDto,
  ): Promise<FilledOrderPageDto> {
    const [orders, total] = await this.orders.findFilledPage(query);
    return PageDto.of(orders.map(FilledOrderResponseDto.from), total, query);
  }
}
