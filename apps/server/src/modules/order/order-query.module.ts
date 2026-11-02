import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Decision } from '@/modules/decision/index.js';
import { Position } from '@/modules/position/index.js';

import { BrokerOrder } from './entities/broker-order.entity.js';
import { FeeSchedule } from './entities/fee-schedule.entity.js';
import { OrderEvent } from './entities/order-event.entity.js';
import { ProtectiveOrder } from './entities/protective-order.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderQueryService } from './order-query.service.js';

// 주문 읽기만 하는 모듈이에요. 주문·취소(OrderModule)는 토스가 필요해 engine에만 있어요
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BrokerOrder,
      FeeSchedule,
      OrderEvent,
      ProtectiveOrder,
      Decision,
      Position,
    ]),
  ],
  providers: [OrderQueryService, OrderRepository],
  exports: [OrderQueryService],
})
export class OrderQueryModule {}
