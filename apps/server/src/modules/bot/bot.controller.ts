import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { OptionDto } from '@/common/options/option.dto.js';

import { BotService } from './bot.service.js';

@ApiTags('bots')
@Controller('bots')
export class BotController {
  constructor(private readonly bots: BotService) {}

  /** 필터용 봇 선택 목록. 끝난 봇도 모두 줘요 */
  @Get('options')
  async findOptions(): Promise<OptionDto[]> {
    const bots = await this.bots.findOptions();
    return bots.map(({ id, name }) => OptionDto.of(String(id), name));
  }
}
