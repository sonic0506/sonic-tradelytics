import { DataSource } from 'typeorm';

import { env } from '@/config/env.js';
import { EngineLock } from '@/infra/database/engine-lock.js';

// engine 단일 실행 잠금을 실제 Postgres로 확인해요 (docs/architecture/engine.md 시작 순서 1번).
describe('EngineLock', () => {
  const dataSources: DataSource[] = [];
  const connect = async (): Promise<DataSource> => {
    const dataSource = await new DataSource({
      type: 'postgres',
      url: env.DATABASE_URL,
    }).initialize();
    dataSources.push(dataSource);
    return dataSource;
  };

  afterAll(async () => {
    await Promise.all(dataSources.map((dataSource) => dataSource.destroy()));
  });

  it('잠금은 하나의 engine만 얻고, 풀면 다른 engine이 얻어요', async () => {
    const first = new EngineLock(await connect());
    const second = new EngineLock(await connect());
    const onLost = vi.fn();

    await expect(first.acquire(onLost)).resolves.toBe(true);
    await expect(second.acquire(onLost)).resolves.toBe(false);

    await first.release();
    await expect(second.acquire(onLost)).resolves.toBe(true);
    await second.release();
    expect(onLost).not.toHaveBeenCalled();
  });

  it('잠금 연결이 끊기면 onLost로 알려요', async () => {
    const admin = await connect();
    const lock = new EngineLock(await connect());
    const onLost = vi.fn();
    await lock.acquire(onLost);

    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = 'advisory' AND granted`,
    );

    await vi.waitFor(
      () => {
        expect(onLost).toHaveBeenCalledOnce();
      },
      { timeout: 8000, interval: 200 },
    );
    // 끊긴 연결로 잠금을 다시 풀려고 하지 않아요(종료 훅이 실패하지 않아요)
    await expect(lock.release()).resolves.toBeUndefined();
  }, 15_000);
});
