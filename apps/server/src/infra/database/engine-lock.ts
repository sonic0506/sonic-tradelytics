import { Injectable, Logger } from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';
import { z } from 'zod';

const lockedRows = z.array(z.object({ locked: z.boolean() }));

// engine은 동시에 하나만 떠요. 둘이 뜨면 이중 주문이 나요(docs/architecture/engine.md 시작 순서 1번).
// 연결에 묶인 Postgres 어드바이저리 락이라 이 연결이 끊기면 Postgres가 잠금을 풀어요.
// 그래서 풀과 따로 연결 하나를 잡아 두고, 끊기면 onLost로 알려 engine이 바로 내려가게 해요.
@Injectable()
export class EngineLock {
  // 이 서비스의 engine 잠금 번호. 다른 용도의 어드바이저리 락과 겹치지 않게 고정해요
  private static readonly KEY = 7_320_001;
  // ponytail: 5초마다 연결을 확인해요. 끊긴 뒤 최대 5초 동안은 모를 수 있어요. 더 빨라야 하면 pg 클라이언트의 end 이벤트를 써요
  private static readonly CHECK_INTERVAL_MS = 5000;

  private readonly logger = new Logger(EngineLock.name);
  private runner: QueryRunner | undefined;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly dataSource: DataSource) {}

  // 잠금을 얻으면 true. 다른 engine이 가지고 있으면 false
  async acquire(onLost: () => void): Promise<boolean> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    const [row] = lockedRows.parse(
      await runner.query('SELECT pg_try_advisory_lock($1) AS locked', [
        EngineLock.KEY,
      ]),
    );
    if (!row?.locked) {
      await runner.release();
      return false;
    }
    this.runner = runner;
    this.timer = setInterval(() => {
      runner.query('SELECT 1').catch((error: unknown) => {
        this.logger.error({ err: error }, '잠금 연결이 끊겼어요');
        this.stopChecking();
        // 연결과 함께 잠금도 이미 풀렸어요. 종료할 때 다시 풀지 않게 버려요
        this.runner = undefined;
        onLost();
      });
    }, EngineLock.CHECK_INTERVAL_MS);
    return true;
  }

  async release(): Promise<void> {
    this.stopChecking();
    const runner = this.runner;
    if (!runner) return;
    this.runner = undefined;
    // 연결을 돌려주면 세션이 끝나지 않으므로(풀에 남아요) 먼저 잠금을 풀어요
    await runner.query('SELECT pg_advisory_unlock($1)', [EngineLock.KEY]);
    await runner.release();
  }

  private stopChecking(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
