import { Module } from '@nestjs/common';

import { BotModule } from '@/modules/bot/index.js';

import { BotSetupController } from './bot-setup.controller.js';
import { BotSetupService } from './bot-setup.service.js';

// 봇 만들기 화면 (F1): 기본값과 생성
@Module({
  imports: [BotModule],
  controllers: [BotSetupController],
  providers: [BotSetupService],
})
export class BotSetupModule {}
