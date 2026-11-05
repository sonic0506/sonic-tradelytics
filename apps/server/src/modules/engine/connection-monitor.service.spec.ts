import { Test } from '@nestjs/testing';

import { TossClient } from '@/infra/toss/toss.client.js';
import { TossSocket } from '@/infra/toss/toss-socket.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { MarketCalendarService } from '@/modules/market-data/index.js';
import { RiskService } from '@/modules/risk/index.js';

import { ConnectionMonitorService } from './connection-monitor.service.js';

const REASON = '토스 API 403 ip-not-allowed: 허용되지 않은 IP 주소입니다.';
const START = 1_000_000;
const LIMIT_MS = 60_000;

describe('ConnectionMonitorService', () => {
  const toss = { unreachableReason: vi.fn<TossClient['unreachableReason']>() };
  const socket = { isConnected: vi.fn<TossSocket['isConnected']>() };
  const calendar = {
    isRegularSession: vi.fn<MarketCalendarService['isRegularSession']>(),
  };
  const risk = { record: vi.fn<RiskService['record']>() };
  let engineState: EngineStateService;
  let monitor: ConnectionMonitorService;

  beforeEach(async () => {
    vi.resetAllMocks();
    calendar.isRegularSession.mockReturnValue(true);
    socket.isConnected.mockReturnValue(true);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConnectionMonitorService,
        EngineStateService,
        { provide: TossClient, useValue: toss },
        { provide: TossSocket, useValue: socket },
        { provide: MarketCalendarService, useValue: calendar },
        { provide: RiskService, useValue: risk },
      ],
    }).compile();
    monitor = moduleRef.get(ConnectionMonitorService);
    engineState = moduleRef.get(EngineStateService);
  });

  it('토스에 1분 동안 닿지 못하면 신규 진입을 막고 feed_stale을 한 번만 남겨요', async () => {
    toss.unreachableReason.mockReturnValue(REASON);

    await monitor.check(START);
    await monitor.check(START + LIMIT_MS - 1);
    expect(engineState.haltReasons()).toEqual([]);
    expect(risk.record).not.toHaveBeenCalled();

    await monitor.check(START + LIMIT_MS);
    await monitor.check(START + LIMIT_MS + 5000);

    expect(engineState.haltReasons()).toEqual(['feed_stale']);
    expect(risk.record).toHaveBeenCalledTimes(1);
    expect(risk.record).toHaveBeenCalledWith('feed_stale', null, {
      rest: REASON,
      socketConnected: true,
    });
  });

  it('웹소켓만 1분 동안 끊겨도 같게 처리해요', async () => {
    toss.unreachableReason.mockReturnValue(undefined);
    socket.isConnected.mockReturnValue(false);

    await monitor.check(START);
    await monitor.check(START + LIMIT_MS);

    expect(engineState.haltReasons()).toEqual(['feed_stale']);
    expect(risk.record).toHaveBeenCalledWith('feed_stale', null, {
      rest: null,
      socketConnected: false,
    });
  });

  it('1분 안에 복구되면 시간을 처음부터 다시 재요', async () => {
    toss.unreachableReason.mockReturnValue(REASON);
    await monitor.check(START);
    toss.unreachableReason.mockReturnValue(undefined);
    await monitor.check(START + 5000);
    toss.unreachableReason.mockReturnValue(REASON);
    await monitor.check(START + LIMIT_MS);

    expect(engineState.haltReasons()).toEqual([]);
    expect(risk.record).not.toHaveBeenCalled();
  });

  it('복구되면 정지를 풀고, 다시 끊기면 또 남겨요', async () => {
    toss.unreachableReason.mockReturnValue(REASON);
    await monitor.check(START);
    await monitor.check(START + LIMIT_MS);

    toss.unreachableReason.mockReturnValue(undefined);
    await monitor.check(START + LIMIT_MS + 5000);
    expect(engineState.haltReasons()).toEqual([]);

    toss.unreachableReason.mockReturnValue(REASON);
    await monitor.check(START + 2 * LIMIT_MS);
    await monitor.check(START + 3 * LIMIT_MS);
    expect(risk.record).toHaveBeenCalledTimes(2);
  });

  it('장 시간이 아니면 끊겨도 정지하지 않아요', async () => {
    calendar.isRegularSession.mockReturnValue(false);
    toss.unreachableReason.mockReturnValue(REASON);

    await monitor.check(START);
    await monitor.check(START + LIMIT_MS);

    expect(engineState.haltReasons()).toEqual([]);
    expect(risk.record).not.toHaveBeenCalled();
  });

  it('기록이 실패해도 정지는 유지하고 다음 확인 때 다시 남겨요', async () => {
    toss.unreachableReason.mockReturnValue(REASON);
    risk.record.mockRejectedValueOnce(new Error('db down'));
    await monitor.check(START);
    await monitor.check(START + LIMIT_MS);
    expect(engineState.haltReasons()).toEqual(['feed_stale']);

    await monitor.check(START + LIMIT_MS + 5000);
    expect(risk.record).toHaveBeenCalledTimes(2);
  });
});
