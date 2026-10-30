import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '@/common/exceptions/api-errors.js';

import { EngineStatusResponseDto } from './dto/engine-status-response.dto.js';
import { EngineStatusNotFoundException } from './engine-state.exception.js';
import { EngineStatusService } from './engine-status.service.js';

@ApiTags('engine')
@Controller('engine-status')
export class EngineStatusController {
  constructor(private readonly statuses: EngineStatusService) {}

  /** engine 상태와 오늘 장 일정 (모든 화면 머리 띠, 10초마다) */
  @ApiErrors(EngineStatusNotFoundException)
  @Get()
  async find(): Promise<EngineStatusResponseDto> {
    const { status, today } = await this.statuses.current();
    return EngineStatusResponseDto.from(status, today);
  }
}
