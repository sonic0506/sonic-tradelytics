import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderModule } from '@/modules/order/index.js';

import { AccountSnapshotRepository } from './account-snapshot.repository.js';
import { AccountSnapshotService } from './account-snapshot.service.js';
import { AccountSyncService } from './account-sync.service.js';
import { AccountSnapshot } from './entities/account-snapshot.entity.js';

// engine 전용이에요. AccountSync·스냅샷은 TossModule(engine 진입점에만 있음)에 기대요.
@Module({
  imports: [TypeOrmModule.forFeature([AccountSnapshot]), OrderModule],
  providers: [
    AccountSyncService,
    AccountSnapshotService,
    AccountSnapshotRepository,
  ],
  exports: [AccountSyncService, AccountSnapshotService],
})
export class AccountModule {}
