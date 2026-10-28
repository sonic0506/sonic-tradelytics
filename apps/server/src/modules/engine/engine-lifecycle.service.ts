import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { EngineLock } from '@/infra/database/engine-lock.js';
import { TossClient } from '@/infra/toss/toss.client.js';

import { EngineAlreadyRunningException } from './engine.exception.js';

// engine의 시작·종료 순서 (docs/architecture/engine.md 시작 순서·종료 순서).
// 지금은 1번(단일 실행 잠금)과 2번(토큰)만 있어요. 3번부터는 그 기능을 만들 때 여기에 더해요.
@Injectable()
export class EngineLifecycleService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(EngineLifecycleService.name);

  constructor(
    private readonly lock: EngineLock,
    private readonly toss: TossClient,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const hasLock = await this.lock.acquire(() => {
      this.onLockLost();
    });
    if (!hasLock) throw new EngineAlreadyRunningException();
    await this.toss.ensureToken();
    this.logger.log('engine 시작');
  }

  // 미체결 주문과 손절 조건주문은 그대로 둬요. 손절은 서버가 없어도 증권사에서 작동해요 (POL-RISK-11)
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`engine 종료 (${signal ?? '신호 없음'})`);
    await this.lock.release();
  }

  // 잠금을 잃으면 다른 engine이 잠금을 가져가기 전에 내려가요. Docker가 다시 띄워요
  private onLockLost(): void {
    this.logger.error('단일 실행 잠금을 잃었어요. 종료해요');
    process.kill(process.pid, 'SIGTERM');
  }
}
