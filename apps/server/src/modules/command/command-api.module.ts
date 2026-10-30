import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Bot, BotModule } from '@/modules/bot/index.js';

import { CommandController } from './command.controller.js';
import { CommandRepository } from './command.repository.js';
import { CommandRequestService } from './command-request.service.js';
import { Command } from './entities/command.entity.js';

// api 쪽 명령 저장 모듈이에요(INSERT + NOTIFY). 실행(CommandModule)은 토스·주문이 필요해 engine에만 있어요
@Module({
  imports: [TypeOrmModule.forFeature([Command, Bot]), BotModule],
  controllers: [CommandController],
  providers: [CommandRequestService, CommandRepository],
})
export class CommandApiModule {}
