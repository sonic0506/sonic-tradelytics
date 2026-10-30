import { Test } from '@nestjs/testing';

import { env } from '@/config/env.js';
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

import { BotRunnerService } from './bot-runner.service.js';
import { EngineAlreadyRunningException } from './engine.exception.js';
import { EngineLifecycleService } from './engine-lifecycle.service.js';
import { EngineScheduleService } from './engine-schedule.service.js';
import { StatusReporterService } from './status-reporter.service.js';

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
  const commands = {
    restore: vi.fn<CommandService['restore']>(),
    start: vi.fn<CommandService['start']>(),
    stop: vi.fn<CommandService['stop']>(),
  };
  const calendar = {
    ensureToday: vi.fn<MarketCalendarService['ensureToday']>(),
    isRegularSession: vi.fn<MarketCalendarService['isRegularSession']>(),
  };
  const notifications = {
    start: vi.fn<NotificationService['start']>(),
    stop: vi.fn<NotificationService['stop']>(),
  };
  const statusReporter = {
    start: vi.fn<StatusReporterService['start']>(),
    stop: vi.fn<StatusReporterService['stop']>(),
    report: vi.fn<StatusReporterService['report']>(),
  };
  const schedule = {
    start: vi.fn<EngineScheduleService['start']>(),
    stop: vi.fn<EngineScheduleService['stop']>(),
  };
  const orders = {
    recoverRequested: vi.fn<OrderService['recoverRequested']>(),
    startBroker: vi.fn<OrderService['startBroker']>(),
    stopBroker: vi.fn<OrderService['stopBroker']>(),
  };
  const botRunner = {
    start: vi.fn<BotRunnerService['start']>(),
    stop: vi.fn<BotRunnerService['stop']>(),
  };
  let engineState: EngineStateService;
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
        { provide: CommandService, useValue: commands },
        { provide: MarketCalendarService, useValue: calendar },
        { provide: NotificationService, useValue: notifications },
        { provide: StatusReporterService, useValue: statusReporter },
        { provide: EngineScheduleService, useValue: schedule },
        { provide: OrderService, useValue: orders },
        { provide: BotRunnerService, useValue: botRunner },
        EngineStateService,
      ],
    }).compile();
    service = moduleRef.get(EngineLifecycleService);
    engineState = moduleRef.get(EngineStateService);
  });

  it('다른 engine이 잠금을 가지고 있으면 토큰을 건드리지 않고 시작을 멈춰요', async () => {
    lock.acquire.mockResolvedValue(false);

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      EngineAlreadyRunningException,
    );
    expect(toss.ensureToken).not.toHaveBeenCalled();
    expect(marketCollector.start).not.toHaveBeenCalled();
  });

  describe('BotRunner (시작 순서 10번)', () => {
    afterEach(() => {
      env.BROKER_MODE = 'toss';
    });

    it('실전 모드에서는 M5 전이라 봇을 돌리지 않아요', async () => {
      lock.acquire.mockResolvedValue(true);

      await service.onApplicationBootstrap();

      expect(botRunner.start).not.toHaveBeenCalled();
    });

    it('개발 점검 모드에서는 배치 일정 뒤에 봇을 돌리고, 종료할 때 가장 먼저 멈춰요', async () => {
      env.BROKER_MODE = 'paper';
      lock.acquire.mockResolvedValue(true);

      await service.onApplicationBootstrap();
      await service.onApplicationShutdown('SIGTERM');

      expect(botRunner.start).toHaveBeenCalledAfter(schedule.start);
      expect(botRunner.stop).toHaveBeenCalledBefore(schedule.stop);
    });
  });

  it('잠금을 얻은 뒤에 토큰을 준비하고, 웹소켓을 연 다음 주문을 재동기화해요', async () => {
    lock.acquire.mockResolvedValue(true);

    await service.onApplicationBootstrap();

    expect(toss.ensureToken).toHaveBeenCalledOnce();
    expect(marketCollector.start).toHaveBeenCalledOnce();
    expect(accountSync.syncAll).toHaveBeenCalledAfter(marketCollector.start);
    expect(accountSync.start).toHaveBeenCalledOnce();
  });

  it('정지 상태를 복원한 뒤 매매 준비를 하고, 명령 처리는 재동기화 뒤에 시작해요', async () => {
    lock.acquire.mockResolvedValue(true);

    await service.onApplicationBootstrap();

    expect(calendar.ensureToday).toHaveBeenCalledAfter(toss.ensureToken);
    expect(commands.restore).toHaveBeenCalledAfter(calendar.ensureToday);
    expect(commands.restore).toHaveBeenCalledBefore(marketCollector.start);
    // 시작 순서 5번: 응답을 못 받은 주문 정리는 정지 상태 복원 뒤, 재동기화 전이에요
    expect(orders.startBroker).toHaveBeenCalledBefore(orders.recoverRequested);
    expect(orders.recoverRequested).toHaveBeenCalledAfter(commands.restore);
    expect(orders.recoverRequested).toHaveBeenCalledBefore(accountSync.syncAll);
    expect(commands.start).toHaveBeenCalledAfter(accountSync.syncAll);
  });

  it('알림을 가장 먼저 켜고, 명령 처리 뒤에 상태 쓰기와 배치 일정을 시작해요', async () => {
    lock.acquire.mockResolvedValue(true);

    await service.onApplicationBootstrap();

    expect(notifications.start).toHaveBeenCalledBefore(toss.ensureToken);
    expect(statusReporter.start).toHaveBeenCalledAfter(commands.start);
    expect(schedule.start).toHaveBeenCalledAfter(commands.start);
  });

  it('주기 재동기화는 장 캘린더의 정규장 시간에만 돌아요', async () => {
    lock.acquire.mockResolvedValue(true);
    calendar.isRegularSession.mockReturnValue(false);
    await service.onApplicationBootstrap();

    const [isTradingHours] = accountSync.start.mock.lastCall ?? [];

    expect(isTradingHours?.()).toBe(false);
    expect(calendar.isRegularSession).toHaveBeenCalledOnce();
  });

  it('오늘 장 캘린더를 받지 못하면 시작을 멈춰요', async () => {
    lock.acquire.mockResolvedValue(true);
    calendar.ensureToday.mockRejectedValue(new Error('toss down'));

    await expect(service.onApplicationBootstrap()).rejects.toThrow('toss down');
    expect(marketCollector.start).not.toHaveBeenCalled();
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
    '신호가 %s여도 종료할 때 주문을 막고 명령·재동기화·시세 수집을 멈춘 뒤 잠금을 풀어요',
    async (signal) => {
      await service.onApplicationShutdown(signal);

      expect(engineState.state()).toBe('stopping');
      expect(schedule.stop).toHaveBeenCalledOnce();
      expect(statusReporter.report).toHaveBeenCalledOnce();
      expect(notifications.stop).toHaveBeenCalledOnce();
      expect(commands.stop).toHaveBeenCalledOnce();
      expect(accountSync.stop).toHaveBeenCalledOnce();
      expect(marketCollector.stop).toHaveBeenCalledOnce();
      expect(orders.stopBroker).toHaveBeenCalledOnce();
      expect(lock.release).toHaveBeenCalledOnce();
    },
  );
});
