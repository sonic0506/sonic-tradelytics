import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '@/common/exceptions/api-errors.js';
import { PageDto } from '@/common/pagination/page.dto.js';
import { PageQueryDto } from '@/common/pagination/page-query.dto.js';

import {
  BotNotFoundException,
  BotOverviewService,
  ReleaseCriteriaNotMetException,
} from './bot-overview.service.js';
import { BotDetailDto } from './dto/bot-detail.dto.js';
import { BotListItemDto, BotPageDto } from './dto/bot-list-item.dto.js';

@ApiTags('bots')
@Controller('bots')
export class BotOverviewController {
  constructor(private readonly overview: BotOverviewService) {}

  /** 봇 목록 (상태·투자금·오늘 손익·오늘 운영 상황) */
  @Get()
  async findPage(@Query() query: PageQueryDto): Promise<BotPageDto> {
    const [bots, total] = await this.overview.findPage(query);
    return PageDto.of(bots.map(BotListItemDto.from), total, query);
  }

  /** 봇 상세 (자금·손실 여유·규칙 값·쉬는 중 여부·보유 종목) */
  @ApiErrors(BotNotFoundException)
  @Get(':id')
  async find(@Param('id', ParseIntPipe) id: number): Promise<BotDetailDto> {
    return BotDetailDto.fromDetail(await this.overview.find(id));
  }

  /** 상한 해제 (FR-BOT-06). 기준(POL-RISK-13)을 모두 넘은 검증 구간 봇만 풀려요. 이미 풀린 봇은 그대로 204예요 */
  @ApiErrors(BotNotFoundException, ReleaseCriteriaNotMetException)
  @Post(':id/release')
  @HttpCode(HttpStatus.NO_CONTENT)
  async release(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.overview.release(id);
  }
}
