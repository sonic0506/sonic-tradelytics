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
import {
  MarketCalendarService,
  MarketCollectorService,
} from '@/modules/market-data/index.js';
import { NotificationService } from '@/modules/notification/index.js';
import { OrderService } from '@/modules/order/index.js';

import { EngineAlreadyRunningException } from './engine.exception.js';
import { EngineScheduleService } from './engine-schedule.service.js';
import { StatusReporterService } from './status-reporter.service.js';

// engine의 시작·종료 순서 (docs/architecture/engine.md 시작 순서·종료 순서).
// 지금은 1~9번이 있어요. 10번(BotRunner)은 그 기능을 만들 때 더해요.
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
    private readonly calendar: MarketCalendarService,
    private readonly notifications: NotificationService,
    private readonly statusReporter: StatusReporterService,
    private readonly schedule: EngineScheduleService,
    private readonly orders: OrderService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const hasLock = await this.lock.acquire(() => {
      this.onLockLost();
    });
    if (!hasLock) throw new EngineAlreadyRunningException();
    // 시작 중 실패(batch_fail 등)도 알리도록 알림을 먼저 켜요
    this.notifications.start();
    await this.toss.ensureToken();
    await this.calendar.ensureToday();
    await this.commands.restore();
    // 개발 점검이면 모의 체결을 먼저 켜요. 응답 유실 복구가 모의 주문 목록을 봐요
    await this.orders.startBroker();
    await this.orders.recoverRequested();
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
    this.accountSync.start(() => this.calendar.isRegularSession());
    await this.commands.start();
    this.statusReporter.start();
    await this.schedule.start();
    this.logger.log('engine 시작');
  }

  // 미체결 주문과 손절 조건주문은 그대로 둬요. 손절은 서버가 없어도 증권사에서 작동해요 (POL-RISK-11)
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`engine 종료 (${signal ?? '신호 없음'})`);
    // 신규 판단과 주문을 먼저 막아요 (종료 순서 1번)
    this.engineState.halt('stopping');
    this.schedule.stop();
    this.commands.stop();
    this.accountSync.stop();
    this.orders.stopBroker();
    this.marketCollector.stop();
    // 화면에 종료 중으로 남기고 멈춰요
    this.statusReporter.stop();
    await this.statusReporter.report();
    this.notifications.stop();
    await this.lock.release();
  }

  // 잠금을 잃으면 다른 engine이 잠금을 가져가기 전에 내려가요. Docker가 다시 띄워요
  private onLockLost(): void {
    this.logger.error('단일 실행 잠금을 잃었어요. 종료해요');
    process.kill(process.pid, 'SIGTERM');
  }
}
