import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '@/common/exceptions/api-errors.js';

import { PositionDetailDto } from './dto/position-detail.dto.js';
import { PositionHistoryQueryDto } from './dto/position-history-query.dto.js';
import { PositionHistoryDto } from './dto/position-row.dto.js';
import { PositionSummaryDto } from './dto/position-summary.dto.js';
import {
  HistoryService,
  PositionNotFoundException,
} from './history.service.js';

@ApiTags('positions')
@Controller()
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  /** 투자 내역 (FR-PERF-04~07). 최신 진입순, 상태를 정하지 않으면 보유 중을 첫 페이지 맨 위에 모두 넣어요 */
  @Get('positions')
  findPage(
    @Query() query: PositionHistoryQueryDto,
  ): Promise<PositionHistoryDto> {
    return this.history.history(query);
  }

  /** 투자 내역 상단 요약. botIds가 봇 하나면 그 봇의 자금, 아니면 필터에 맞는 포지션 전체 요약 */
  @Get('position-summaries')
  summary(
    @Query() query: PositionHistoryQueryDto,
  ): Promise<PositionSummaryDto> {
    return this.history.summary(query);
  }

  /** 펼친 거래 한 줄: 주문, 진입 판단과 조건, 실제 결과, 채점, 판단 흐름 (FR-PERF-04, F3 근거 카드) */
  @ApiErrors(PositionNotFoundException)
  @Get('positions/:id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PositionDetailDto> {
    return this.history.detail(id);
  }
}
