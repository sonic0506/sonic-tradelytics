import { Test } from '@nestjs/testing';

import { type Bot, BotService, type BotVersion } from '@/modules/bot/index.js';
import { DecisionService } from '@/modules/decision/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { FundService } from '@/modules/fund/index.js';
import {
  MarketCalendarService,
  MarketCollectorService,
  MarketScanService,
  type MarketSnapshot,
} from '@/modules/market-data/index.js';
import { OrderService } from '@/modules/order/index.js';
import { type Position, PositionService } from '@/modules/position/index.js';
import { RiskService } from '@/modules/risk/index.js';

import { BotRunnerService } from './bot-runner.service.js';

describe('BotRunnerService', () => {
  const bots = {
    findTrading: vi.fn<BotService['findTrading']>(),
    setStatus: vi.fn<BotService['setStatus']>(),
  };
  const calendar = {
    isRegularSession: vi.fn<MarketCalendarService['isRegularSession']>(),
  };
  const collector = {
    snapshot: vi.fn<MarketCollectorService['snapshot']>(),
    watch: vi.fn<MarketCollectorService['watch']>(),
  };
  const scanner = {
    rankByTradingAmount: vi.fn<MarketScanService['rankByTradingAmount']>(),
    intradayStats: vi.fn<MarketScanService['intradayStats']>(),
    stockStatus: vi.fn<MarketScanService['stockStatus']>(),
    forget: vi.fn<MarketScanService['forget']>(),
  };
  const positions = {
    findHeldByBot: vi.fn<PositionService['findHeldByBot']>(),
    botHoldings: vi.fn<PositionService['botHoldings']>(),
    recentExitReasons: vi.fn<PositionService['recentExitReasons']>(),
  };
  const fund = {
    entryBudget: vi.fn<FundService['entryBudget']>(),
    activeAllocation: vi.fn<FundService['activeAllocation']>(),
  };
  const decisions = { record: vi.fn<DecisionService['record']>() };
  const orders = {
    enter: vi.fn<OrderService['enter']>(),
    exit: vi.fn<OrderService['exit']>(),
    exitState: vi.fn<OrderService['exitState']>(),
    liquidate: vi.fn<OrderService['liquidate']>(),
  };
  const risk = {
    record: vi.fn<RiskService['record']>(),
    stopBot: vi.fn<RiskService['stopBot']>(),
  };
  let state: EngineStateService;
  let runner: BotRunnerService;

  // 2026-10-30(금) 10:00 KST
  const now = new Date('2026-10-30T01:00:00Z');
  const bot = Object.assign({
    id: 7,
    type: 'day_trading',
    status: 'running',
    tradingStart: '09:00:00',
    tradingEnd: '15:30:00',
    updatedAt: new Date('2026-10-29T00:00:00Z'),
  }) as Bot;
  const version = (fields: Partial<BotVersion> = {}): BotVersion =>
    Object.assign(
      {
        id: 70,
        params: {},
        orderSizeType: 'fixed',
        orderSizeValue: 50_000,
        maxPositions: 3,
        dailyLossPct: 4,
        totalLossPct: 10,
        onDailyLimit: 'liquidate',
        stopStreak: 3,
      },
      fields,
    ) as BotVersion;
  const snapshot = (price: number, ask?: number): MarketSnapshot => ({
    price,
    asks: ask === undefined ? [] : [{ price: ask, volume: 10 }],
    bids: [],
    receivedAt: now.getTime(),
  });
  const clean = {
    warnings: [],
    liquidationTrading: false,
    krxTradingSuspended: false,
    nxtTradingSuspended: false,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    calendar.isRegularSession.mockReturnValue(true);
    bots.findTrading.mockResolvedValue([{ bot, version: version() }]);
    // 1위는 시가 대비 +0.5%라 탈락, 2위가 모든 조건 충족
    scanner.rankByTradingAmount.mockResolvedValue([
      { symbol: '000001', rank: 1 },
      { symbol: '005930', rank: 2 },
    ]);
    collector.snapshot.mockImplementation((symbol) =>
      symbol === '005930' ? snapshot(10_300, 10_310) : snapshot(10_050),
    );
    scanner.intradayStats.mockResolvedValue({
      openPrice: 10_000,
      vwap: 10_250,
    });
    scanner.stockStatus.mockResolvedValue(clean);
    positions.findHeldByBot.mockResolvedValue([]);
    fund.entryBudget.mockResolvedValue(49_950);
    fund.activeAllocation.mockResolvedValue(null);
    orders.exitState.mockResolvedValue({ hasOpenOrders: false, takenSteps: 0 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        BotRunnerService,
        EngineStateService,
        { provide: BotService, useValue: bots },
        { provide: MarketCalendarService, useValue: calendar },
        { provide: MarketCollectorService, useValue: collector },
        { provide: MarketScanService, useValue: scanner },
        { provide: PositionService, useValue: positions },
        { provide: FundService, useValue: fund },
        { provide: DecisionService, useValue: decisions },
        { provide: OrderService, useValue: orders },
        { provide: RiskService, useValue: risk },
      ],
    }).compile();
    runner = moduleRef.get(BotRunnerService);
    state = moduleRef.get(EngineStateService);
  });

  afterEach(() => {
    runner.stop();
    vi.useRealTimers();
  });

  it('정규장이 아니면 봇을 읽지도 않아요', async () => {
    calendar.isRegularSession.mockReturnValue(false);

    await runner.cycle(now);

    expect(bots.findTrading).not.toHaveBeenCalled();
  });

  it('거래대금 순위대로 보고 조건을 모두 충족한 첫 종목을 매도 1호가로 진입해요', async () => {
    await runner.cycle(now);

    expect(collector.watch).toHaveBeenCalledWith([], ['000001', '005930']);
    expect(orders.enter).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        botId: 7,
        botVersionId: 70,
        symbol: '005930',
        price: 10_310,
        quantity: 4,
      }),
    );
    const [request] = orders.enter.mock.lastCall ?? [];
    expect(request?.rationale).toMatchObject({
      failed: [],
      score: 100,
      direction: 'up',
      targetPrice: 10_720,
      stopPrice: 10_100,
      horizonMinutes: 315,
    });
  });

  it('보유 중인 종목은 다시 사지 않고, 동시 보유 수가 차면 후보를 보지 않아요', async () => {
    positions.findHeldByBot.mockResolvedValue([
      Object.assign({ symbol: '005930', quantity: 0 }) as Position,
    ]);
    await runner.cycle(now);
    expect(orders.enter).not.toHaveBeenCalled();
    // 1위만 보고 보유 중인 2위는 보지 않았어요
    expect(scanner.intradayStats).toHaveBeenCalledOnce();

    bots.findTrading.mockResolvedValue([
      { bot, version: version({ maxPositions: 1 }) },
    ]);
    await runner.cycle(new Date(now.getTime() + 10_000));
    expect(scanner.intradayStats).toHaveBeenCalledOnce();
  });

  it('확정 투자금이 없으면 후보를 보지 않아요', async () => {
    fund.entryBudget.mockResolvedValue(0);

    await runner.cycle(now);

    expect(scanner.intradayStats).not.toHaveBeenCalled();
    expect(orders.enter).not.toHaveBeenCalled();
  });

  it('매수 유의 종목이면 건너뛴 판단을 하루에 한 번만 남겨요', async () => {
    scanner.stockStatus.mockResolvedValue({
      ...clean,
      warnings: ['VI_STATIC'],
    });

    await runner.cycle(now);
    await runner.cycle(new Date(now.getTime() + 10_000));

    expect(orders.enter).not.toHaveBeenCalled();
    expect(decisions.record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        kind: 'skip',
        skipReason: 'market_alert',
        symbol: '005930',
        positionId: null,
        score: 100,
      }),
    );
  });

  it('한 주도 살 수 없으면 자금 사유로 건너뛰어요', async () => {
    fund.entryBudget.mockResolvedValue(10_000);

    await runner.cycle(now);

    expect(orders.enter).not.toHaveBeenCalled();
    expect(decisions.record).toHaveBeenCalledWith(
      expect.objectContaining({ skipReason: 'funds' }),
    );
  });

  it('장 마감 전 청산 시각(15:15)부터는 진입하지 않아요', async () => {
    await runner.cycle(new Date('2026-10-30T06:15:00Z'));

    expect(fund.entryBudget).not.toHaveBeenCalled();
  });

  it('정지된 봇은 진입하지 않아요', async () => {
    state.blockBot(7, 'pause');

    await runner.cycle(now);

    expect(fund.entryBudget).not.toHaveBeenCalled();
  });

  it('규칙 값 모양이 틀리면 그 봇만 bot_error로 멈추고 알려요', async () => {
    bots.findTrading.mockResolvedValue([
      { bot, version: version({ params: { maxRank: 'many' } }) },
    ]);

    await runner.cycle(now);

    expect(state.canEnter(7)).toBe(false);
    expect(bots.setStatus).toHaveBeenCalledWith(7, 'paused', 'bot_error');
    expect(risk.record.mock.lastCall?.slice(0, 2)).toEqual(['bot_error', 7]);
  });

  it('순위를 받지 못하면 이전 후보로 계속해요', async () => {
    await runner.cycle(now);
    scanner.rankByTradingAmount.mockRejectedValue(new Error('toss down'));
    orders.enter.mockClear();

    await runner.cycle(new Date(now.getTime() + 60_000));

    expect(orders.enter).toHaveBeenCalledOnce();
  });

  it('10초마다 주기를 돌고 멈추면 그만둬요', async () => {
    vi.useFakeTimers({ now });
    runner.start();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(bots.findTrading).toHaveBeenCalledOnce();

    runner.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(bots.findTrading).toHaveBeenCalledOnce();
  });

  describe('청산', () => {
    // 10,310원에 4주 보유
    const holding = (fields: Partial<Position> = {}): Position =>
      Object.assign(
        { id: 40, symbol: '005930', quantity: 4, costBasis: 41_240 },
        fields,
      ) as Position;
    const exitRequest = () => orders.exit.mock.lastCall?.[0];

    beforeEach(() => {
      positions.findHeldByBot.mockResolvedValue([holding()]);
    });

    it('+2%에 닿으면 절반을 시장가로 팔고 근거를 남겨요', async () => {
      collector.snapshot.mockReturnValue(snapshot(10_520));

      await runner.cycle(now);

      expect(exitRequest()).toEqual({
        positionId: 40,
        botVersionId: 70,
        reason: 'take_profit',
        orderType: 'MARKET',
        price: null,
        markPrice: 10_520,
        quantity: 2,
        rationale: {
          passed: [{ rule: 'take_profit_1', value: 2.04, threshold: 2 }],
          failed: [],
          score: null,
        },
      });
    });

    it('이미 한 단계를 팔았으면 +4%까지 기다려요', async () => {
      collector.snapshot.mockReturnValue(snapshot(10_520));
      orders.exitState.mockResolvedValue({
        hasOpenOrders: false,
        takenSteps: 1,
      });

      await runner.cycle(now);

      expect(orders.exit).not.toHaveBeenCalled();
    });

    it('VWAP 아래로 내려가면 규칙 청산(rule_exit)으로 전량 팔아요', async () => {
      collector.snapshot.mockReturnValue(snapshot(10_180));

      await runner.cycle(now);

      expect(exitRequest()).toMatchObject({
        reason: 'rule_exit',
        quantity: 4,
      });
    });

    it('미체결 주문이 있으면 결과를 기다려요', async () => {
      collector.snapshot.mockReturnValue(snapshot(10_520));
      orders.exitState.mockResolvedValue({
        hasOpenOrders: true,
        takenSteps: 0,
      });

      await runner.cycle(now);

      expect(orders.exit).not.toHaveBeenCalled();
    });

    it('일시정지 봇도 15:15에는 장 마감 청산을 하고 진입은 하지 않아요', async () => {
      bots.findTrading.mockResolvedValue([
        {
          bot: Object.assign({}, bot, { status: 'paused' }),
          version: version(),
        },
      ]);

      await runner.cycle(new Date('2026-10-30T06:15:00Z'));

      expect(exitRequest()).toMatchObject({
        reason: 'market_close',
        quantity: 4,
      });
      expect(fund.activeAllocation).not.toHaveBeenCalled();
      expect(orders.enter).not.toHaveBeenCalled();
    });
  });

  describe('손실 한도와 연속 손절', () => {
    const since = new Date('2026-10-29T23:59:00Z');
    // 확정 투자금 10만 원: 하루 -4% = 4,000원, 누적 -10% = 10,000원
    const realized = (total: number, daily: number) => {
      positions.botHoldings.mockImplementation(([target]) =>
        Promise.resolve(
          new Map([
            [
              7,
              {
                holdingsCost: 0,
                hasHoldings: false,
                realizedPnl: target?.since === since ? total : daily,
              },
            ],
          ]),
        ),
      );
    };

    beforeEach(() => {
      fund.activeAllocation.mockResolvedValue({ amount: 100_000, since });
      positions.recentExitReasons.mockResolvedValue([]);
    });

    it('하루 손실이 한도에 닿으면 봇을 멈추고 설정대로 청산하고 진입하지 않아요', async () => {
      realized(-3_000, -3_000);
      // 보유분 평가 -1,000원 (41,240 → 10,060 × 4)
      positions.findHeldByBot.mockResolvedValue([
        Object.assign({
          id: 40,
          symbol: '000001',
          quantity: 4,
          costBasis: 41_240,
        }) as Position,
      ]);
      collector.snapshot.mockReturnValue(snapshot(10_060));

      await runner.cycle(now);

      expect(risk.stopBot).toHaveBeenCalledWith(7, 'daily_stop', {
        amount: 100_000,
        dailyPnl: -4_000,
        totalPnl: -4_000,
      });
      expect(orders.liquidate).toHaveBeenCalledWith('loss_limit', 7);
      expect(orders.enter).not.toHaveBeenCalled();
    });

    it('하루 한도에서 보유 유지를 골랐으면 멈추기만 해요', async () => {
      realized(-4_000, -4_000);
      bots.findTrading.mockResolvedValue([
        { bot, version: version({ onDailyLimit: 'hold' }) },
      ]);

      await runner.cycle(now);

      expect(risk.stopBot.mock.lastCall?.[1]).toBe('daily_stop');
      expect(orders.liquidate).not.toHaveBeenCalled();
    });

    it('누적 손실이 한도에 닿으면 봇을 끝내고 청산해요', async () => {
      realized(-10_000, 0);

      await runner.cycle(now);

      expect(risk.stopBot.mock.lastCall?.[1]).toBe('total_stop');
      expect(orders.liquidate).toHaveBeenCalledWith('loss_limit', 7);
    });

    it('재개 뒤 연속 3번 손절이면 일시정지해요', async () => {
      realized(0, 0);
      positions.recentExitReasons.mockResolvedValue([
        'stop_loss',
        'stop_loss',
        'stop_loss',
      ]);

      await runner.cycle(now);

      expect(positions.recentExitReasons).toHaveBeenCalledWith(
        7,
        bot.updatedAt,
        3,
      );
      expect(risk.stopBot).toHaveBeenCalledWith(7, 'streak_pause', {
        stopStreak: 3,
      });
      expect(orders.enter).not.toHaveBeenCalled();
    });

    it('한도 안이면 그대로 진입해요', async () => {
      realized(-1_000, -1_000);

      await runner.cycle(now);

      expect(risk.stopBot).not.toHaveBeenCalled();
      expect(orders.enter).toHaveBeenCalledOnce();
    });
  });
});
