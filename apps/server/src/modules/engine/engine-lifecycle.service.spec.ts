import { Test } from '@nestjs/testing';

import { EngineLock } from '@/infra/database/engine-lock.js';
import { TossClient } from '@/infra/toss/toss.client.js';

import { EngineAlreadyRunningException } from './engine.exception.js';
import { EngineLifecycleService } from './engine-lifecycle.service.js';

describe('EngineLifecycleService', () => {
  const lock = {
    acquire: vi.fn<EngineLock['acquire']>(),
    release: vi.fn<EngineLock['release']>(),
  };
  const toss = { ensureToken: vi.fn<TossClient['ensureToken']>() };
  let service: EngineLifecycleService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EngineLifecycleService,
        { provide: EngineLock, useValue: lock },
        { provide: TossClient, useValue: toss },
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
  });

  it('잠금을 얻은 뒤에 토큰을 준비해요', async () => {
    lock.acquire.mockResolvedValue(true);

    await service.onApplicationBootstrap();

    expect(toss.ensureToken).toHaveBeenCalledOnce();
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
    '신호가 %s여도 종료할 때 잠금을 풀어요',
    async (signal) => {
      await service.onApplicationShutdown(signal);

      expect(lock.release).toHaveBeenCalledOnce();
    },
  );
});
