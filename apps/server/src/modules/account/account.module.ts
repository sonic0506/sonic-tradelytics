import { Module } from '@nestjs/common';

import { OrderModule } from '@/modules/order/index.js';

import { AccountSyncService } from './account-sync.service.js';

// engine 전용이에요. AccountSync는 TossModule(engine 진입점에만 있음)에 기대요.
@Module({
  imports: [OrderModule],
  providers: [AccountSyncService],
  exports: [AccountSyncService],
})
export class AccountModule {}
