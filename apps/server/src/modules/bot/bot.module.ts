import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BotController } from './bot.controller.js';
import { BotRepository } from './bot.repository.js';
import { BotService } from './bot.service.js';
import { Bot } from './entities/bot.entity.js';
import { BotVersion } from './entities/bot-version.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Bot, BotVersion])],
  controllers: [BotController],
  providers: [BotService, BotRepository],
  exports: [BotService],
})
export class BotModule {}
