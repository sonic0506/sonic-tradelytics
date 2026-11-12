import {
  Body,
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
  BotParamsInvalidException,
  BotVersionPendingException,
  BotVersionUnchangedException,
  ReleaseCriteriaNotMetException,
} from './bot-overview.service.js';
import {
  BotDailyResultListDto,
  BotDailyResultQueryDto,
} from './dto/bot-daily-result.dto.js';
import { BotDetailDto } from './dto/bot-detail.dto.js';
import { BotListItemDto, BotPageDto } from './dto/bot-list-item.dto.js';
import {
  BotVersionListDto,
  CreateBotVersionDto,
  CreatedBotVersionDto,
  VersionPreviewDto,
} from './dto/bot-version.dto.js';

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

  /** 봇의 일별 손익(실현 + 장 마감 평가)과 그날 검증 구간이었는지 (FR-PERF-03, 10). 날짜순, 장후 배치 전이라 오늘 행은 없어요 */
  @ApiErrors(BotNotFoundException)
  @Get(':id/daily-results')
  async findDailyResults(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: BotDailyResultQueryDto,
  ): Promise<BotDailyResultListDto> {
    return { items: await this.overview.dailyResults(id, query) };
  }

  /** 규칙 값 버전 목록 (FR-BOT-03). 최신이 앞이고, 바뀐 값은 바로 앞 버전과 비교해요 */
  @ApiErrors(BotNotFoundException)
  @Get(':id/versions')
  async findVersions(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BotVersionListDto> {
    return { items: await this.overview.versions(id) };
  }

  /** 바꾸려는 값을 저장하면 어떻게 되는지 (FR-BOT-11). 변경 종류는 서버가 정하고, 저장하지 않아요 */
  @ApiErrors(BotNotFoundException, BotParamsInvalidException)
  @Post(':id/version-previews')
  @HttpCode(HttpStatus.OK)
  previewVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: CreateBotVersionDto,
  ): Promise<VersionPreviewDto> {
    return this.overview.previewVersion(id, request);
  }

  /** 새 규칙 값 버전 (FR-BOT-03, 11). 쉬는 중(또는 시작 전)이면 바로 적용하고, 아니면 쉬는 중이 된 뒤 적용해요 (POL-RISK-13) */
  @ApiErrors(
    BotNotFoundException,
    BotParamsInvalidException,
    BotVersionPendingException,
    BotVersionUnchangedException,
  )
  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  addVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: CreateBotVersionDto,
  ): Promise<CreatedBotVersionDto> {
    return this.overview.addVersion(id, request);
  }

  /** 상한 해제 (FR-BOT-06). 기준(POL-RISK-13)을 모두 넘은 검증 구간 봇만 풀려요. 이미 풀린 봇은 그대로 204예요 */
  @ApiErrors(BotNotFoundException, ReleaseCriteriaNotMetException)
  @Post(':id/release')
  @HttpCode(HttpStatus.NO_CONTENT)
  async release(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.overview.release(id);
  }
}
