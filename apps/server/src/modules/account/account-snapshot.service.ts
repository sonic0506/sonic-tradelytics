import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';

import { AccountSnapshotRepository } from './account-snapshot.repository.js';
import type { AccountSnapshot } from './entities/account-snapshot.entity.js';

const buyingPowerSchema = z.object({
  cashBuyingPower: z.coerce.number().transform(Math.floor),
});

// 배분 기준 시점의 운용 자산 스냅샷 (POL-FUND-01, 02, 09)
@Injectable()
export class AccountSnapshotService {
  // 배분은 판단용 호출이 아니라 한도를 기다려도 돼요
  private static readonly WAIT_MS = 5000;

  constructor(
    private readonly toss: TossClient,
    private readonly snapshots: AccountSnapshotRepository,
  ) {}

  // 주문 가능 금액(cashBuyingPower)을 지금 받아 운용 자산 = 주문 가능 금액 − 실행 중 봇 현금 몫으로 남겨요
  async take(runningBotsCashShare: number): Promise<AccountSnapshot> {
    const { cashBuyingPower } = await this.toss.request({
      group: 'ORDER_INFO',
      path: '/api/v1/buying-power',
      query: { currency: 'KRW' },
      account: true,
      waitMs: AccountSnapshotService.WAIT_MS,
      result: buyingPowerSchema,
    });
    return this.snapshots.add({
      takenAt: new Date(),
      orderableCash: cashBuyingPower,
      runningBotsCashShare,
    });
  }
}
