import { Module } from '@nestjs/common';

import { BotModule } from '@/modules/bot/index.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';
import { FundQueryModule } from '@/modules/fund/index.js';

import { BotSetupController } from './bot-setup.controller.js';
import { BotSetupService } from './bot-setup.service.js';

// 봇 만들기 화면 (F1): 기본값, 배분 미리보기, 생성
@Module({
  imports: [BotModule, EngineStateModule, FundQueryModule],
  controllers: [BotSetupController],
  providers: [BotSetupService],
})
export class BotSetupModule {}
