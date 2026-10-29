import { Module } from '@nestjs/common';

import { RiskModule } from '@/modules/risk/index.js';

import { NotificationService } from './notification.service.js';

// engine 전용이에요. TelegramClient는 EngineAppModule이 전역으로 넣어요.
@Module({
  imports: [RiskModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
