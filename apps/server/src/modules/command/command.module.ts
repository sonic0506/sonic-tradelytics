import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Bot, BotModule } from '@/modules/bot/index.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';
import { FundModule } from '@/modules/fund/index.js';
import { RiskModule } from '@/modules/risk/index.js';

import { CommandRepository } from './command.repository.js';
import { CommandService } from './command.service.js';
import { Command } from './entities/command.entity.js';

// engine 쪽 명령 처리예요. EngineLock(LISTEN 연결)은 EngineAppModule이 전역으로 넣어요.
// api 쪽 명령 저장(INSERT + NOTIFY)은 화면 API를 만들 때 따로 둬요.
@Module({
  imports: [
    TypeOrmModule.forFeature([Command, Bot]),
    BotModule,
    EngineStateModule,
    FundModule,
    RiskModule,
  ],
  providers: [CommandService, CommandRepository],
  exports: [CommandService],
})
export class CommandModule {}
