import { Test } from '@nestjs/testing';
import type { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';

import { AccountSnapshotRepository } from './account-snapshot.repository.js';
import { AccountSnapshotService } from './account-snapshot.service.js';
import type { AccountSnapshot } from './entities/account-snapshot.entity.js';

describe('AccountSnapshotService', () => {
  const toss = {
    request: vi.fn<(options: { result: z.ZodType }) => Promise<unknown>>(),
  };
  const snapshots = { add: vi.fn<AccountSnapshotRepository['add']>() };
  const now = new Date('2026-10-28T23:59:00Z');
  let service: AccountSnapshotService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now, toFake: ['Date'] });
    // TossClient처럼 응답 result를 넘겨받은 스키마로 검증해요
    toss.request.mockImplementation(({ result }) =>
      Promise.resolve(
        result.parse({ currency: 'KRW', cashBuyingPower: '1000000.5' }),
      ),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountSnapshotService,
        { provide: TossClient, useValue: toss },
        { provide: AccountSnapshotRepository, useValue: snapshots },
      ],
    }).compile();
    service = moduleRef.get(AccountSnapshotService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('주문 가능 금액(원 단위 내림)과 실행 중 봇 현금 몫으로 스냅샷을 남겨요', async () => {
    const saved = Object.assign({ id: 1 }) as AccountSnapshot;
    snapshots.add.mockResolvedValue(saved);

    await expect(service.take(160_000)).resolves.toBe(saved);

    expect(toss.request).toHaveBeenCalledWith(
      expect.objectContaining({
        group: 'ORDER_INFO',
        path: '/api/v1/buying-power',
        query: { currency: 'KRW' },
        account: true,
      }),
    );
    expect(snapshots.add).toHaveBeenCalledWith({
      takenAt: now,
      orderableCash: 1_000_000,
      runningBotsCashShare: 160_000,
    });
  });
});
