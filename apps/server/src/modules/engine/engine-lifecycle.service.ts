import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { EngineLock } from '@/infra/database/engine-lock.js';
import { TossClient } from '@/infra/toss/toss.client.js';
import { AccountSyncService } from '@/modules/account/index.js';
import { CommandService } from '@/modules/command/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { MarketCollectorService } from '@/modules/market-data/index.js';

import { EngineAlreadyRunningException } from './engine.exception.js';

// engine의 시작·종료 순서 (docs/architecture/engine.md 시작 순서·종료 순서).
// 지금은 1번(단일 실행 잠금), 2번(토큰), 4번(정지 상태 복원), 6번(주문 재동기화), 7번(웹소켓), 8번(명령)만 있어요. 나머지는 그 기능을 만들 때 여기에 더해요.
@Injectable()
export class EngineLifecycleService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(EngineLifecycleService.name);

  constructor(
    private readonly lock: EngineLock,
    private readonly toss: TossClient,
    private readonly marketCollector: MarketCollectorService,
    private readonly accountSync: AccountSyncService,
    private readonly engineState: EngineStateService,
    private readonly commands: CommandService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const hasLock = await this.lock.acquire(() => {
      this.onLockLost();
    });
    if (!hasLock) throw new EngineAlreadyRunningException();
    await this.toss.ensureToken();
    await this.commands.restore();
    // 웹소켓을 먼저 열어 재동기화하는 동안 들어온 주문 이벤트도 받아요. 둘은 AccountSync 안에서 차례로 반영돼요
    this.marketCollector.start({
      onOrder: (data) => {
        this.accountSync.receive(data);
      },
      onReconnected: () => {
        this.accountSync.resync();
      },
    });
    await this.accountSync.syncAll();
    this.accountSync.start();
    await this.commands.start();
    this.logger.log('engine 시작');
  }

  // 미체결 주문과 손절 조건주문은 그대로 둬요. 손절은 서버가 없어도 증권사에서 작동해요 (POL-RISK-11)
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`engine 종료 (${signal ?? '신호 없음'})`);
    // 신규 판단과 주문을 먼저 막아요 (종료 순서 1번)
    this.engineState.halt('stopping');
    this.commands.stop();
    this.accountSync.stop();
    this.marketCollector.stop();
    await this.lock.release();
  }

  // 잠금을 잃으면 다른 engine이 잠금을 가져가기 전에 내려가요. Docker가 다시 띄워요
  private onLockLost(): void {
    this.logger.error('단일 실행 잠금을 잃었어요. 종료해요');
    process.kill(process.pid, 'SIGTERM');
  }
}
