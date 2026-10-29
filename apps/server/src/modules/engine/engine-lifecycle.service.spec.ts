import { Test } from '@nestjs/testing';

import { EngineLock } from '@/infra/database/engine-lock.js';
import { TossClient } from '@/infra/toss/toss.client.js';
import { AccountSyncService } from '@/modules/account/index.js';
import { MarketCollectorService } from '@/modules/market-data/index.js';

import { EngineAlreadyRunningException } from './engine.exception.js';
import { EngineLifecycleService } from './engine-lifecycle.service.js';

describe('EngineLifecycleService', () => {
  const lock = {
    acquire: vi.fn<EngineLock['acquire']>(),
    release: vi.fn<EngineLock['release']>(),
  };
  const toss = { ensureToken: vi.fn<TossClient['ensureToken']>() };
  const marketCollector = {
    start: vi.fn<MarketCollectorService['start']>(),
    stop: vi.fn<MarketCollectorService['stop']>(),
  };
  const accountSync = {
    syncAll: vi.fn<AccountSyncService['syncAll']>(),
    start: vi.fn<AccountSyncService['start']>(),
    stop: vi.fn<AccountSyncService['stop']>(),
    receive: vi.fn<AccountSyncService['receive']>(),
    resync: vi.fn<AccountSyncService['resync']>(),
  };
  let service: EngineLifecycleService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EngineLifecycleService,
        { provide: EngineLock, useValue: lock },
        { provide: TossClient, useValue: toss },
        { provide: MarketCollectorService, useValue: marketCollector },
        { provide: AccountSyncService, useValue: accountSync },
      ],
    }).compile();
    service = moduleRef.get(EngineLifecycleService);
  });

  it('다른 engine이 잠금을 가지고 있으면 토큰을 건드리지 않고 시작을 멈춰요', async () => {
    lock.acquire.mockResolvedValue(false);

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      EngineAlreadyRunningException,
    );
    expect(toss.ensureToken).not.toHaveBeenCalled();
    expect(marketCollector.start).not.toHaveBeenCalled();
  });

  it('잠금을 얻은 뒤에 토큰을 준비하고, 웹소켓을 연 다음 주문을 재동기화해요', async () => {
    lock.acquire.mockResolvedValue(true);

    await service.onApplicationBootstrap();

    expect(toss.ensureToken).toHaveBeenCalledOnce();
    expect(marketCollector.start).toHaveBeenCalledOnce();
    expect(accountSync.syncAll).toHaveBeenCalledAfter(marketCollector.start);
    expect(accountSync.start).toHaveBeenCalledOnce();
  });

  it('주문 재동기화가 실패하면 시작을 멈춰요', async () => {
    lock.acquire.mockResolvedValue(true);
    accountSync.syncAll.mockRejectedValue(new Error('toss down'));

    await expect(service.onApplicationBootstrap()).rejects.toThrow('toss down');
    expect(accountSync.start).not.toHaveBeenCalled();
  });

  it('웹소켓의 주문 이벤트와 재연결을 AccountSync에 넘겨요', async () => {
    lock.acquire.mockResolvedValue(true);
    await service.onApplicationBootstrap();
    const [orderStream] = marketCollector.start.mock.lastCall ?? [];

    orderStream?.onOrder({ event: 'FILL' });
    orderStream?.onReconnected();

    expect(accountSync.receive).toHaveBeenCalledWith({ event: 'FILL' });
    expect(accountSync.resync).toHaveBeenCalledOnce();
  });

  it('잠금을 잃으면 스스로 SIGTERM을 보내 내려가요', async () => {
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true);
    lock.acquire.mockResolvedValue(true);
    await service.onApplicationBootstrap();

    const [onLost] = lock.acquire.mock.lastCall ?? [];
    onLost?.();

    expect(kill).toHaveBeenCalledWith(process.pid, 'SIGTERM');
    kill.mockRestore();
  });

  it.each(['SIGTERM', undefined])(
    '신호가 %s여도 종료할 때 재동기화·시세 수집을 멈추고 잠금을 풀어요',
    async (signal) => {
      await service.onApplicationShutdown(signal);

      expect(accountSync.stop).toHaveBeenCalledOnce();
      expect(marketCollector.stop).toHaveBeenCalledOnce();
      expect(lock.release).toHaveBeenCalledOnce();
    },
  );
});
