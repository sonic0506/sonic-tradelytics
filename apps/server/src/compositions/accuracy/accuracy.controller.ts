import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AccuracyService } from './accuracy.service.js';
import {
  AccuracyStatsDto,
  AccuracyStatsQueryDto,
} from './dto/accuracy-stats.dto.js';

@ApiTags('accuracy-stats')
@Controller('accuracy-stats')
export class AccuracyController {
  constructor(private readonly accuracy: AccuracyService) {}

  /** 정확도 분석 (FR-RAT-05, 06): 봇별 예측 채점 요약과 신뢰 점수 구간별 승률 */
  @Get()
  find(@Query() query: AccuracyStatsQueryDto): Promise<AccuracyStatsDto> {
    return this.accuracy.stats(query);
  }
}
