import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '@/common/exceptions/api-errors.js';

import {
  BotParamsInvalidException,
  BotSetupService,
  BotTypeNotSupportedException,
  BudgetRatioExceededException,
  TradingHoursOutOfRangeException,
} from './bot-setup.service.js';
import { BotDefaultsQueryDto } from './dto/bot-defaults-query.dto.js';
import { BotDefaultsResponseDto } from './dto/bot-defaults-response.dto.js';
import { CreateBotDto, CreatedBotDto } from './dto/create-bot.dto.js';

@ApiTags('bots')
@Controller()
export class BotSetupController {
  constructor(private readonly setup: BotSetupService) {}

  /** 유형·성향별 기본값 (봇 만들기 1단계 자동 입력) */
  @ApiErrors(BotTypeNotSupportedException)
  @Get('bot-defaults')
  findDefaults(@Query() query: BotDefaultsQueryDto): BotDefaultsResponseDto {
    return this.setup.defaults(query.type, query.riskProfile);
  }

  /** 봇과 첫 규칙 버전을 저장해요. 시작(투자금 확정)은 engine이 운용 시작일 운영 시각에 해요 */
  @ApiErrors(
    BotTypeNotSupportedException,
    TradingHoursOutOfRangeException,
    BudgetRatioExceededException,
    BotParamsInvalidException,
  )
  @Post('bots')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateBotDto): Promise<CreatedBotDto> {
    const bot = await this.setup.create(body);
    return { id: String(bot.id) };
  }
}
