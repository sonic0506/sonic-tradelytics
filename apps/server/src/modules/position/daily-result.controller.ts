import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { DailyResultQueryDto } from './dto/daily-result-query.dto.js';
import {
  DailyResultListDto,
  DailyResultResponseDto,
} from './dto/daily-result-response.dto.js';
import { PositionService } from './position.service.js';

@ApiTags('daily-results')
@Controller('daily-results')
export class DailyResultController {
  constructor(private readonly positions: PositionService) {}

  /** 봇 전체의 일별 손익 합계 (FR-PERF-01, 03). 장후 배치 전이라 오늘 행은 없어요. 직접 거래는 빠져요 */
  @Get()
  async findAll(
    @Query() query: DailyResultQueryDto,
  ): Promise<DailyResultListDto> {
    const totals = await this.positions.dailyTotals(query.from, query.to);
    return { items: totals.map(DailyResultResponseDto.from) };
  }
}
