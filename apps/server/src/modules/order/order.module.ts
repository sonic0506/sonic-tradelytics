import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Decision, DecisionModule } from '@/modules/decision/index.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';
import { PositionModule } from '@/modules/position/index.js';
import { RiskModule } from '@/modules/risk/index.js';

import { BrokerOrder } from './entities/broker-order.entity.js';
import { OrderEvent } from './entities/order-event.entity.js';
import { ProtectiveOrder } from './entities/protective-order.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';
import { TossBrokerService } from './toss-broker.service.js';

@Module({
  // relation 대상(Decision)도 등록해야 TypeORM이 BrokerOrder 메타데이터를 만들어요
  imports: [
    TypeOrmModule.forFeature([
      BrokerOrder,
      OrderEvent,
      ProtectiveOrder,
      Decision,
    ]),
    PositionModule,
    DecisionModule,
    EngineStateModule,
    RiskModule,
  ],
  providers: [OrderService, OrderRepository, TossBrokerService],
  exports: [OrderService],
})
export class OrderModule {}
