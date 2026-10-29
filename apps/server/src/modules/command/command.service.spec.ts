import { Test } from '@nestjs/testing';

import { EngineLock } from '@/infra/database/engine-lock.js';
import { type Bot, BotService } from '@/modules/bot/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { FundService } from '@/modules/fund/index.js';
import { OrderService } from '@/modules/order/index.js';
import { RiskService } from '@/modules/risk/index.js';

import { noOpTransactionalModule } from '../../../test/setup/transactional.js';
import type { CommandKind } from './command.constants.js';
import { CommandRepository } from './command.repository.js';
import { CommandService } from './command.service.js';
import type { Command } from './entities/command.entity.js';

describe('CommandService', () => {
  const lock = { listenCommands: vi.fn<EngineLock['listenCommands']>() };
  const commands = {
    findPending: vi.fn<CommandRepository['findPending']>(),
    markHandled: vi.fn<CommandRepository['markHandled']>(),
    latestHandledAt: vi.fn<CommandRepository['latestHandledAt']>(),
  };
  const bots = {
    findById: vi.fn<BotService['findById']>(),
    findInactive: vi.fn<BotService['findInactive']>(),
    setStatus: vi.fn<BotService['setStatus']>(),
    stopAll: vi.fn<BotService['stopAll']>(),
  };
  const risk = {
    record: vi.fn<RiskService['record']>(),
    latestAt: vi.fn<RiskService['latestAt']>(),
  };
  const fund = { rebudget: vi.fn<FundService['rebudget']>() };
  const orders = {
    cancelOpen: vi.fn<OrderService['cancelOpen']>(),
    liquidate: vi.fn<OrderService['liquidate']>(),
  };
  let state: EngineStateService;
  let service: CommandService;

  const command = (kind: CommandKind, fields: Partial<Command> = {}): Command =>
    Object.assign(
      {
        id: 1,
        kind,
        botId: kind === 'kill' ? null : 7,
        liquidateAll: false,
        budget: null,
        handledAt: null,
      },
      fields,
    ) as Command;
  const bot = (fields: Partial<Bot> = {}): Bot =>
    Object.assign(
      { id: 7, status: 'running', statusReason: null },
      fields,
    ) as Bot;
  // start()가 처리한 명령의 결과
  const handled = () =>
    commands.markHandled.mock.calls.map(([id, result, error]) => ({
      id,
      result,
      error,
    }));

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    commands.findPending.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      imports: [noOpTransactionalModule],
      providers: [
        CommandService,
        EngineStateService,
        { provide: EngineLock, useValue: lock },
        { provide: CommandRepository, useValue: commands },
        { provide: BotService, useValue: bots },
        { provide: RiskService, useValue: risk },
        { provide: FundService, useValue: fund },
        { provide: OrderService, useValue: orders },
      ],
    }).compile();
    service = moduleRef.get(CommandService);
    state = moduleRef.get(EngineStateService);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it('킬 스위치는 모든 봇을 멈추고 kill_switch를 기록해요', async () => {
    commands.findPending.mockResolvedValueOnce([command('kill')]);

    await service.start();

    expect(state.canEnter(7)).toBe(false);
    expect(state.haltReasons()).toEqual(['kill']);
    expect(bots.stopAll).toHaveBeenCalledWith('kill_switch');
    expect(risk.record).toHaveBeenCalledWith('kill_switch', null, {
      commandId: 1,
      liquidateAll: false,
    });
    expect(handled()).toEqual([{ id: 1, result: 'ok', error: null }]);
  });

  it('킬 스위치는 DB 기록이 실패해도 메모리에서는 이미 신규 진입을 막아요', async () => {
    commands.findPending.mockResolvedValueOnce([command('kill')]);
    bots.stopAll.mockRejectedValue(new Error('db down'));

    await service.start();

    expect(state.canEnter(7)).toBe(false);
    expect(handled()).toEqual([
      { id: 1, result: 'failed', error: 'Error: db down' },
    ]);
  });

  it('전량 청산을 고른 킬 스위치는 모든 미체결을 취소하고 보유분을 청산해요', async () => {
    commands.findPending.mockResolvedValueOnce([
      command('kill', { liquidateAll: true }),
    ]);

    await service.start();

    expect(state.haltReasons()).toEqual(['kill']);
    expect(handled()).toEqual([{ id: 1, result: 'ok', error: null }]);
    expect(orders.cancelOpen).toHaveBeenCalledWith({});
    expect(orders.liquidate).toHaveBeenCalledWith('kill_switch');
  });

  it('pause는 그 봇만 멈춰요', async () => {
    commands.findPending.mockResolvedValueOnce([command('pause')]);
    bots.findById.mockResolvedValue(bot());

    await service.start();

    expect(state.canEnter(7)).toBe(false);
    expect(state.canEnter(8)).toBe(true);
    expect(bots.setStatus).toHaveBeenCalledWith(7, 'paused', 'pause');
    expect(handled()).toEqual([{ id: 1, result: 'ok', error: null }]);
    expect(orders.cancelOpen).toHaveBeenCalledWith({ botId: 7, side: 'BUY' });
  });

  it('없는 봇의 명령은 failed로 남겨요', async () => {
    commands.findPending.mockResolvedValueOnce([command('pause')]);
    bots.findById.mockResolvedValue(null);

    await service.start();

    expect(bots.setStatus).not.toHaveBeenCalled();
    expect(handled()).toEqual([
      { id: 1, result: 'failed', error: '봇을 찾을 수 없어요' },
    ]);
  });

  it('킬 스위치 뒤 resume은 그 봇을 다시 돌리고 전체 정지를 풀어요', async () => {
    commands.findPending.mockResolvedValueOnce([
      command('kill', { id: 1 }),
      command('resume', { id: 2 }),
    ]);
    bots.findById.mockResolvedValue(
      bot({ status: 'stopped', statusReason: 'kill_switch' }),
    );

    await service.start();

    expect(bots.setStatus).toHaveBeenCalledWith(7, 'running', null);
    expect(state.canEnter(7)).toBe(true);
    expect(handled().map(({ id }) => id)).toEqual([1, 2]);
  });

  it('손실 한도로 멈춘 봇은 resume으로 풀지 않아요', async () => {
    state.blockBot(7, 'daily_stop');
    commands.findPending.mockResolvedValueOnce([command('resume')]);
    bots.findById.mockResolvedValue(
      bot({ status: 'paused', statusReason: 'daily_stop' }),
    );

    await service.start();

    expect(state.canEnter(7)).toBe(false);
    expect(bots.setStatus).not.toHaveBeenCalled();
    expect(handled()).toEqual([
      {
        id: 1,
        result: 'failed',
        error: '손실 한도로 멈춘 봇은 다시 시작할 수 없어요',
      },
    ]);
  });

  it('liquidate는 봇을 멈추고 미체결을 취소한 뒤 청산해요', async () => {
    commands.findPending.mockResolvedValueOnce([command('liquidate')]);
    bots.findById.mockResolvedValue(bot());

    await service.start();

    expect(state.canEnter(7)).toBe(false);
    expect(bots.setStatus).toHaveBeenCalledWith(7, 'stopped', 'liquidate');
    expect(handled()[0]?.result).toBe('ok');
    expect(orders.cancelOpen).toHaveBeenCalledWith({ botId: 7 });
    expect(orders.liquidate).toHaveBeenCalledWith('manual', 7);
  });

  it('rebudget은 새 투자금 설정을 FundService에 넘기고 결과를 남겨요', async () => {
    const budget = { budgetType: 'fixed', budgetAmount: 300_000 };
    commands.findPending.mockResolvedValueOnce([
      command('rebudget', { budget }),
    ]);
    fund.rebudget.mockResolvedValue({ ok: true });

    await service.start();

    expect(fund.rebudget).toHaveBeenCalledWith(7, budget);
    expect(handled()).toEqual([{ id: 1, result: 'ok', error: null }]);
  });

  it('rebudget을 할 수 없으면 이유를 남기고 기존 투자금을 그대로 둬요', async () => {
    commands.findPending.mockResolvedValueOnce([command('rebudget')]);
    fund.rebudget.mockResolvedValue({
      ok: false,
      error: 'BOT_NOT_RESTING:holding',
    });

    await service.start();

    expect(handled()).toEqual([
      { id: 1, result: 'failed', error: 'BOT_NOT_RESTING:holding' },
    ]);
  });

  it('NOTIFY를 받으면 바로 미처리 명령을 다시 읽어요', async () => {
    await service.start();
    const [onNotify] = lock.listenCommands.mock.lastCall ?? [];
    commands.findPending.mockResolvedValueOnce([command('kill')]);

    onNotify?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(state.haltReasons()).toEqual(['kill']);
  });

  it('NOTIFY를 놓쳐도 5초마다 다시 읽고, 멈추면 그만둬요', async () => {
    await service.start();
    expect(commands.findPending).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(commands.findPending).toHaveBeenCalledTimes(3);

    service.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(commands.findPending).toHaveBeenCalledTimes(3);
  });

  it('처리 중에 또 깨우면 겹치지 않고 끝난 뒤 한 번 더 읽어요', async () => {
    let finish: (value: Command[]) => void = () => undefined;
    commands.findPending.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const started = service.start();
    await vi.advanceTimersByTimeAsync(0);
    const [onNotify] = lock.listenCommands.mock.lastCall ?? [];

    onNotify?.();
    onNotify?.();
    expect(commands.findPending).toHaveBeenCalledTimes(1);

    finish([]);
    await started;
    await vi.advanceTimersByTimeAsync(0);
    expect(commands.findPending).toHaveBeenCalledTimes(2);
  });

  it('시작할 때 명령을 읽지 못하면 던져요', async () => {
    commands.findPending.mockRejectedValueOnce(new Error('db down'));

    await expect(service.start()).rejects.toThrow('db down');
  });

  describe('restore', () => {
    beforeEach(() => {
      bots.findInactive.mockResolvedValue([
        bot({ id: 3, status: 'paused', statusReason: 'daily_stop' }),
        bot({ id: 4, status: 'waiting_funds', statusReason: null }),
      ]);
    });

    it('멈춘 봇을 사유와 함께 다시 막아요', async () => {
      await service.restore();

      expect(state.botBlockReason(3)).toBe('daily_stop');
      expect(state.botBlockReason(4)).toBe('waiting_funds');
      expect(state.haltReasons()).toEqual([]);
    });

    it('마지막 킬 스위치 뒤에 resume이 없으면 전체 정지를 복원해요', async () => {
      risk.latestAt.mockResolvedValue(new Date('2026-10-29T01:00:00Z'));
      commands.latestHandledAt.mockResolvedValue(
        new Date('2026-10-29T00:00:00Z'),
      );

      await service.restore();

      expect(state.haltReasons()).toEqual(['kill']);
    });

    it('킬 스위치 뒤에 resume이 있었으면 전체 정지는 복원하지 않아요', async () => {
      risk.latestAt.mockResolvedValue(new Date('2026-10-29T00:00:00Z'));
      commands.latestHandledAt.mockResolvedValue(
        new Date('2026-10-29T01:00:00Z'),
      );

      await service.restore();

      expect(state.haltReasons()).toEqual([]);
    });
  });

  it('미체결을 취소하지 못했거나 팔지 못한 포지션이 남으면 알려요', async () => {
    commands.findPending.mockResolvedValueOnce([
      command('kill', { liquidateAll: true }),
    ]);
    orders.cancelOpen.mockResolvedValue(1);
    orders.liquidate.mockResolvedValue(2);

    await service.start();

    expect(risk.record).toHaveBeenLastCalledWith('order_rejected', null, {
      commandId: 1,
      kind: 'kill',
      uncanceled: 1,
      unsold: 2,
    });
  });
});
