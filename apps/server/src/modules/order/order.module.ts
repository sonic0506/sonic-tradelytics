import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Decision } from '@/modules/decision/index.js';
import { PositionModule } from '@/modules/position/index.js';

import { BrokerOrder } from './entities/broker-order.entity.js';
import { OrderEvent } from './entities/order-event.entity.js';
import { ProtectiveOrder } from './entities/protective-order.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';

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
  ],
  providers: [OrderService, OrderRepository],
  exports: [OrderService],
})
export class OrderModule {}
