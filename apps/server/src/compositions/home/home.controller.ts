import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { HomeDto } from './dto/home.dto.js';
import { HomeService } from './home.service.js';

@ApiTags('home')
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  /** 홈 대시보드: 계좌·오늘 손익·봇 카드·오늘 체결 (FR-PERF-01, 10). web이 5초마다 불러요 */
  @Get()
  find(): Promise<HomeDto> {
    return this.home.summary(new Date());
  }
}
