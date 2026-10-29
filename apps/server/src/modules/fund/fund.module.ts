import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountModule, AccountSnapshot } from '@/modules/account/index.js';
import { Bot, BotModule } from '@/modules/bot/index.js';
import { OrderModule } from '@/modules/order/index.js';
import { PositionModule } from '@/modules/position/index.js';
import { RiskModule } from '@/modules/risk/index.js';

import { AllocationRepository } from './allocation.repository.js';
import { Allocation } from './entities/allocation.entity.js';
import { FundService } from './fund.service.js';

// engine 전용이에요(스냅샷이 토스 buying-power를 불러요).
// relation 대상(Bot, AccountSnapshot)도 등록해야 TypeORM이 Allocation 메타데이터를 만들어요
@Module({
  imports: [
    TypeOrmModule.forFeature([Allocation, Bot, AccountSnapshot]),
    AccountModule,
    BotModule,
    OrderModule,
    PositionModule,
    RiskModule,
  ],
  providers: [FundService, AllocationRepository],
  exports: [FundService],
})
export class FundModule {}
