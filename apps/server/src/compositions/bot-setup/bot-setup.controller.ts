import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '@/common/exceptions/api-errors.js';

import {
  BotBudgetLockedException,
  BotNotFoundException,
  BotParamsInvalidException,
  BotSetupService,
  BotTypeNotSupportedException,
  BudgetRatioExceededException,
  TradingHoursOutOfRangeException,
} from './bot-setup.service.js';
import {
  AllocationPreviewDto,
  AllocationPreviewRequestDto,
} from './dto/allocation-preview.dto.js';
import { BotDefaultsQueryDto } from './dto/bot-defaults-query.dto.js';
import { BotDefaultsResponseDto } from './dto/bot-defaults-response.dto.js';
import { CreateBotDto, CreatedBotDto } from './dto/create-bot.dto.js';
import { UpdateBotDto, UpdatedBotDto } from './dto/update-bot.dto.js';

// "HH:mm:ss" → "HH:mm"
const HH_MM = 5;

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

  /** 판단에 쓰이지 않는 설정 바꾸기. 투자금은 시작 전(ready·waiting_funds)만 */
  @ApiErrors(
    BotNotFoundException,
    BotBudgetLockedException,
    TradingHoursOutOfRangeException,
    BudgetRatioExceededException,
  )
  @Patch('bots/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBotDto,
  ): Promise<UpdatedBotDto> {
    const bot = await this.setup.update(id, body);
    return {
      id: String(bot.id),
      tradingHours: {
        start: bot.tradingStart.slice(0, HH_MM),
        end: bot.tradingEnd.slice(0, HH_MM),
      },
    };
  }

  /** 저장 전 예상 배분 (FR-BOT-05). 같은 시각에 시작하는 확정 전 봇들과 함께 engine 확정과 같은 계산을 해요. 저장하지 않아요(200) */
  @ApiErrors(TradingHoursOutOfRangeException)
  @Post('allocation-previews')
  @HttpCode(HttpStatus.OK)
  previewAllocation(
    @Body() request: AllocationPreviewRequestDto,
  ): Promise<AllocationPreviewDto> {
    return this.setup.previewAllocation(request);
  }
}
