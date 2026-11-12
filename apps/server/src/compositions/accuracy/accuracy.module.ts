import { Module } from '@nestjs/common';

import { BotModule } from '@/modules/bot/index.js';
import { DecisionModule } from '@/modules/decision/index.js';

import { AccuracyController } from './accuracy.controller.js';
import { AccuracyService } from './accuracy.service.js';

// 정확도 분석 화면. 읽기 전용이라 토스가 필요 없어요
@Module({
  imports: [BotModule, DecisionModule],
  controllers: [AccuracyController],
  providers: [AccuracyService],
})
export class AccuracyModule {}
