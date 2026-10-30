import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PageDto } from '@/common/pagination/page.dto.js';

import { RiskEventQueryDto } from './dto/risk-event-query.dto.js';
import {
  RiskEventPageDto,
  RiskEventResponseDto,
} from './dto/risk-event-response.dto.js';
import { RiskService } from './risk.service.js';

@ApiTags('risk-events')
@Controller('risk-events')
export class RiskEventController {
  constructor(private readonly risk: RiskService) {}

  /** 리스크·장애 이벤트와 알림 여부 (POL-RISK-12). 최신순 */
  @Get()
  async findPage(@Query() query: RiskEventQueryDto): Promise<RiskEventPageDto> {
    const [events, total] = await this.risk.findPage(query);
    return PageDto.of(events.map(RiskEventResponseDto.from), total, query);
  }
}
