import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountSnapshot } from '@/modules/account/index.js';
import { Bot } from '@/modules/bot/index.js';
import { OrderQueryModule } from '@/modules/order/index.js';
import { PositionModule } from '@/modules/position/index.js';

import { AllocationRepository } from './allocation.repository.js';
import { Allocation } from './entities/allocation.entity.js';
import { FundQueryService } from './fund-query.service.js';

// 배분·자금 상태 읽기만 하는 모듈이에요. 확정(FundModule)은 스냅샷이 토스를 불러 engine에만 있어요
@Module({
  imports: [
    TypeOrmModule.forFeature([Allocation, Bot, AccountSnapshot]),
    OrderQueryModule,
    PositionModule,
  ],
  providers: [FundQueryService, AllocationRepository],
  exports: [FundQueryService],
})
export class FundQueryModule {}
