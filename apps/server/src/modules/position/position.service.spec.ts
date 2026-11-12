import { Test } from '@nestjs/testing';

import { type Bot, BotService, type BotVersion } from '@/modules/bot/index.js';
import {
  MarketCalendarQueryService,
  QuoteQueryService,
} from '@/modules/market-data/index.js';

import type { BotDailyResult } from './entities/bot-daily-result.entity.js';
import type { Position } from './entities/position.entity.js';
import { PositionNotFoundException } from './position.exception.js';
import { PositionRepository } from './position.repository.js';
import { PositionService } from './position.service.js';

describe('PositionService', () => {
  const positions = {
    findById: vi.fn<PositionRepository['findById']>(),
    findOpenManual: vi.fn<PositionRepository['findOpenManual']>(),
    createManual: vi.fn<PositionRepository['createManual']>(),
    findForFunds: vi.fn<PositionRepository['findForFunds']>(),
    update: vi.fn<PositionRepository['update']>(),
    findForDailyResults: vi.fn<PositionRepository['findForDailyResults']>(),
    upsertDailyResults: vi.fn<PositionRepository['upsertDailyResults']>(),
    findDailyResults: vi.fn<PositionRepository['findDailyResults']>(),
    findHeldOrOpenedSince: vi.fn<PositionRepository['findHeldOrOpenedSince']>(),
    findClosedBetween: vi.fn<PositionRepository['findClosedBetween']>(),
    findHistory: vi.fn<PositionRepository['findHistory']>(),
    findWithBot: vi.fn<PositionRepository['findWithBot']>(),
  };
  const calendars = {
    recentOpenDays: vi.fn<MarketCalendarQueryService['recentOpenDays']>(),
  };
  const bots = {
    findTrading: vi.fn<BotService['findTrading']>(),
    findWithVersions: vi.fn<BotService['findWithVersions']>(),
  };
  const quotes = { pricesOf: vi.fn<QuoteQueryService['pricesOf']>() };
  let service: PositionService;
  const at = new Date('2026-10-29T01:00:00Z');

  const position = (fields: Partial<Position>): Position => {
    const base: Position = {
      id: 1,
      botId: 7,
      bot: null,
      symbol: '005930',
      status: 'open',
      quantity: 0,
      costBasis: 0,
      realizedPnl: 0,
      totalFees: 0,
      highPrice: null,
      lowPrice: null,
      openedAt: at,
      closedAt: null,
      exitReason: null,
      createdAt: at,
      updatedAt: at,
    };
    return { ...base, ...fields };
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PositionService,
        { provide: PositionRepository, useValue: positions },
        { provide: BotService, useValue: bots },
        { provide: QuoteQueryService, useValue: quotes },
        { provide: MarketCalendarQueryService, useValue: calendars },
      ],
    }).compile();
    service = moduleRef.get(PositionService);
  });

  it('매수 체결은 수량과 매수 금액을 늘리고 수수료를 실현 손익에서 빼요', async () => {
    positions.findById.mockResolvedValue(position({}));

    await service.applyFill(1, {
      side: 'BUY',
      quantity: 10,
      amount: 700_000,
      fees: 100,
      at,
    });

    expect(positions.update).toHaveBeenCalledWith(1, {
      quantity: 10,
      costBasis: 700_000,
      realizedPnl: -100,
      totalFees: 100,
      status: 'open',
      closedAt: null,
      exitReason: null,
    });
  });

  it('매도 체결은 판 수량만큼 평균 매수 금액을 빼고 차익을 실현 손익에 더해요', async () => {
    positions.findById.mockResolvedValue(
      position({ quantity: 10, costBasis: 700_000, totalFees: 100 }),
    );

    await service.applyFill(1, {
      side: 'SELL',
      quantity: 4,
      amount: 300_000,
      fees: 600,
      at,
    });

    expect(positions.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        quantity: 6,
        costBasis: 420_000,
        realizedPnl: 300_000 - 280_000 - 600,
        totalFees: 700,
        status: 'open',
      }),
    );
  });

  it('직접 거래 포지션은 다 팔면 manual로 닫아요', async () => {
    positions.findById.mockResolvedValue(
      position({ botId: null, quantity: 5, costBasis: 350_000 }),
    );

    await service.applyFill(1, {
      side: 'SELL',
      quantity: 5,
      amount: 360_000,
      fees: 0,
      at,
    });

    expect(positions.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        quantity: 0,
        status: 'closed',
        closedAt: at,
        exitReason: 'manual',
      }),
    );
  });

  it('봇 포지션은 다 팔아도 여기서 닫지 않아요', async () => {
    positions.findById.mockResolvedValue(
      position({ quantity: 5, costBasis: 350_000 }),
    );

    await service.applyFill(1, {
      side: 'SELL',
      quantity: 5,
      amount: 360_000,
      fees: 0,
      at,
    });

    expect(positions.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ quantity: 0, status: 'open' }),
    );
  });

  it('보유보다 많이 팔리면 0주에서 멈추고 매수 금액은 0원으로 봐요', async () => {
    positions.findById.mockResolvedValue(position({ botId: null }));

    await service.applyFill(1, {
      side: 'SELL',
      quantity: 3,
      amount: 210_000,
      fees: 0,
      at,
    });

    expect(positions.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ quantity: 0, realizedPnl: 210_000 }),
    );
  });

  it('포지션이 없으면 예외를 던져요', async () => {
    positions.findById.mockResolvedValue(null);

    await expect(
      service.applyFill(9, {
        side: 'BUY',
        quantity: 1,
        amount: 1,
        fees: 0,
        at,
      }),
    ).rejects.toThrow(PositionNotFoundException);
  });

  it('봇마다 보유 매수 금액과 배분 이후 실현 손익을 모아요', async () => {
    const since = new Date('2026-10-29T00:00:00Z');
    positions.findForFunds.mockResolvedValue([
      position({
        id: 1,
        botId: 7,
        quantity: 5,
        costBasis: 350_000,
        openedAt: since,
      }),
      position({
        id: 2,
        botId: 7,
        status: 'closed',
        realizedPnl: 12_000,
        openedAt: new Date('2026-10-29T01:00:00Z'),
      }),
      // 배분 전에 닫힌 포지션의 손익은 넣지 않아요
      position({
        id: 3,
        botId: 7,
        status: 'closed',
        realizedPnl: 99_000,
        openedAt: new Date('2026-10-28T01:00:00Z'),
      }),
      position({ id: 4, botId: 8, quantity: 0, costBasis: 0, openedAt: since }),
    ]);

    const result = await service.botHoldings([
      { botId: 7, since },
      { botId: 8, since },
    ]);

    expect(positions.findForFunds).toHaveBeenCalledWith([7, 8], since);
    expect(result.get(7)).toEqual({
      holdingsCost: 350_000,
      realizedPnl: 12_000,
      hasHoldings: true,
    });
    expect(result.get(8)).toEqual({
      holdingsCost: 0,
      realizedPnl: 0,
      hasHoldings: false,
    });
  });

  it('봇이 없으면 조회하지 않아요', async () => {
    await expect(service.botHoldings([])).resolves.toEqual(new Map());
    expect(positions.findForFunds).not.toHaveBeenCalled();
  });

  it('열린 직접 거래 포지션이 있으면 새로 만들지 않고 그걸 써요', async () => {
    const open = position({ id: 3, botId: null });
    positions.findOpenManual.mockResolvedValue(open);

    await expect(service.openManual('005930', at)).resolves.toBe(open);
    expect(positions.createManual).not.toHaveBeenCalled();
  });

  it('열린 직접 거래 포지션이 없으면 만들어요', async () => {
    const created = position({ id: 4, botId: null });
    positions.findOpenManual.mockResolvedValue(null);
    positions.createManual.mockResolvedValue(created);

    await expect(service.openManual('005930', at)).resolves.toBe(created);
    expect(positions.createManual).toHaveBeenCalledWith('005930', at);
  });

  describe('history', () => {
    it('상태를 정하지 않으면 보유 중을 첫 페이지 맨 위에 모두 넣고 전체 수에 더해요', async () => {
      const held = position({ id: 9, quantity: 3 });
      const closed = position({ id: 8, status: 'closed' });
      positions.findHistory.mockImplementation((filter) =>
        Promise.resolve(
          filter.views?.includes('holding') ? [[held], 1] : [[closed], 5],
        ),
      );

      const first = await service.history({ symbol: '005930' }, 0, 20);
      const second = await service.history({ symbol: '005930' }, 20, 20);

      expect(first).toEqual({ holdings: [held], rows: [closed], total: 6 });
      expect(second.holdings).toEqual([]);
      expect(positions.findHistory).toHaveBeenCalledWith(
        { symbol: '005930', views: ['pending', 'closed', 'canceled'] },
        20,
        20,
      );
    });

    it('상태를 정하면 그 상태만 페이지로 나눠요', async () => {
      positions.findHistory.mockResolvedValue([[], 0]);

      await expect(
        service.history({ views: ['canceled'] }, 0, 20),
      ).resolves.toEqual({ holdings: [], rows: [], total: 0 });
      expect(positions.findHistory).toHaveBeenCalledOnce();
    });

    it('요약용은 필터에 맞는 포지션을 모두 읽어요', async () => {
      positions.findHistory.mockResolvedValue([[position({})], 1]);

      await expect(service.historyAll({})).resolves.toHaveLength(1);
      expect(positions.findHistory).toHaveBeenCalledWith(
        {},
        0,
        expect.any(Number),
      );
    });

    it('펼친 줄 포지션이 없으면 POSITION_NOT_FOUND예요', async () => {
      positions.findWithBot.mockResolvedValue(null);

      await expect(service.findWithBot(1)).rejects.toBeInstanceOf(
        PositionNotFoundException,
      );
    });
  });

  describe('todayPnl', () => {
    const now = new Date('2026-11-12T13:00:00+09:00');

    it('오늘 연 포지션의 실현 손익과 보유분 평가 손익을 봇·직접 거래마다 더해요', async () => {
      positions.findHeldOrOpenedSince.mockResolvedValue([
        position({
          botId: 7,
          status: 'closed',
          realizedPnl: 500,
          openedAt: new Date('2026-11-12T09:30:00+09:00'),
        }),
        // 어제 연 보유분: 실현 손익은 빼고 평가 손익만 더해요
        position({
          botId: 7,
          quantity: 2,
          costBasis: 20_000,
          realizedPnl: 999,
          openedAt: new Date('2026-11-11T10:00:00+09:00'),
        }),
        position({
          botId: null,
          symbol: '000660',
          quantity: 1,
          costBasis: 100_000,
          openedAt: new Date('2026-11-12T10:00:00+09:00'),
        }),
      ]);
      quotes.pricesOf.mockResolvedValue(new Map([['005930', 10_500]]));

      const today = await service.todayPnl(now);

      expect(positions.findHeldOrOpenedSince).toHaveBeenCalledWith(
        new Date('2026-11-12T00:00:00+09:00'),
      );
      // 직접 거래 종목은 최근가가 없어 평가 손익 0
      expect(today.byOwner).toEqual(
        new Map<number | null, number>([
          [7, 1_500],
          [null, 0],
        ]),
      );
      expect(today.holdingSymbolCount).toBe(2);
    });
  });

  describe('recentBotStats', () => {
    it('최근 30거래일 청산으로 승률을, 오늘을 뺀 최근 7거래일 기록으로 일별 손익을 줘요', async () => {
      calendars.recentOpenDays.mockImplementation((_until, count) =>
        Promise.resolve(
          count === 8
            ? ['2026-11-12', '2026-11-11', '2026-11-10']
            : ['2026-11-12', '2026-11-11', '2026-11-10', '2026-11-09'],
        ),
      );
      positions.findClosedBetween.mockResolvedValue([
        position({ botId: 7, realizedPnl: 300 }),
        position({ botId: 7, realizedPnl: -100 }),
        position({ botId: null, realizedPnl: 50 }),
      ]);
      const daily = (tradeDate: string, realizedPnl: number) =>
        Object.assign({
          botId: 8,
          tradeDate,
          realizedPnl,
          unrealizedPnl: 10,
        }) as BotDailyResult;
      positions.findDailyResults.mockResolvedValue([
        daily('2026-11-10', 100),
        daily('2026-11-11', -200),
      ]);

      const stats = await service.recentBotStats('2026-11-12');

      expect(positions.findClosedBetween).toHaveBeenCalledWith({
        start: new Date('2026-11-09T00:00:00+09:00'),
      });
      expect(positions.findDailyResults).toHaveBeenCalledWith({
        from: '2026-11-10',
        to: '2026-11-11',
      });
      expect(stats.get(7)).toEqual({ winRate30d: 0.5, last7Days: [] });
      expect(stats.get(8)).toEqual({
        winRate30d: null,
        last7Days: [110, -190],
      });
    });

    it('지난 개장일을 모르면 일별 기록을 읽지 않아요', async () => {
      calendars.recentOpenDays.mockResolvedValue([]);
      positions.findClosedBetween.mockResolvedValue([]);

      await expect(service.recentBotStats('2026-11-12')).resolves.toEqual(
        new Map(),
      );
      expect(positions.findDailyResults).not.toHaveBeenCalled();
    });
  });

  describe('recordDailyResults', () => {
    const withVersion = (botId: number, versionId: number | null) => ({
      bot: Object.assign({ id: botId }) as Bot,
      version:
        versionId === null
          ? null
          : (Object.assign({ id: versionId }) as BotVersion),
    });

    it('실행 중인 봇과 그날 포지션이 닫힌 봇의 일일 손익을 지금 버전과 함께 남겨요', async () => {
      positions.findForDailyResults.mockResolvedValue([
        position({
          botId: 8,
          status: 'closed',
          realizedPnl: 700,
          totalFees: 40,
          closedAt: new Date('2026-11-09T06:15:00Z'),
        }),
        position({ botId: 7, quantity: 2, costBasis: 20_000 }),
      ]);
      bots.findTrading.mockResolvedValue([withVersion(7, 70)]);
      bots.findWithVersions.mockResolvedValue([withVersion(8, 80)]);
      quotes.pricesOf.mockResolvedValue(new Map([['005930', 10_100]]));

      await service.recordDailyResults('2026-11-09');

      expect(positions.findForDailyResults).toHaveBeenCalledWith(
        new Date('2026-11-08T15:00:00Z'),
      );
      expect(bots.findWithVersions).toHaveBeenCalledWith([8]);
      expect(positions.upsertDailyResults).toHaveBeenCalledWith([
        {
          botId: 7,
          tradeDate: '2026-11-09',
          botVersionId: 70,
          realizedPnl: 0,
          unrealizedPnl: 200,
          fees: 0,
          closedTrades: 0,
        },
        {
          botId: 8,
          tradeDate: '2026-11-09',
          botVersionId: 80,
          realizedPnl: 700,
          unrealizedPnl: 0,
          fees: 40,
          closedTrades: 1,
        },
      ]);
    });

    it('적용된 버전이 없는 봇과 직접 거래 포지션은 빼요', async () => {
      positions.findForDailyResults.mockResolvedValue([
        position({ botId: null, quantity: 1, costBasis: 10_000 }),
      ]);
      bots.findTrading.mockResolvedValue([withVersion(7, null)]);
      bots.findWithVersions.mockResolvedValue([]);
      quotes.pricesOf.mockResolvedValue(new Map());

      await service.recordDailyResults('2026-11-09');

      expect(quotes.pricesOf).toHaveBeenCalledWith([]);
      expect(positions.upsertDailyResults).toHaveBeenCalledWith([]);
    });
  });

  it('봇 전체 일별 손익은 날짜마다 실현·평가 손익, 비용, 청산 수를 더해요', async () => {
    const row = (fields: Partial<BotDailyResult>): BotDailyResult =>
      Object.assign(
        {
          botId: 1,
          botVersionId: 1,
          tradeDate: '2026-11-10',
          realizedPnl: 0,
          unrealizedPnl: 0,
          fees: 0,
          closedTrades: 0,
        },
        fields,
      ) as BotDailyResult;
    positions.findDailyResults.mockResolvedValue([
      row({
        realizedPnl: -4_000,
        unrealizedPnl: 500,
        fees: 900,
        closedTrades: 11,
      }),
      row({ botId: 2, realizedPnl: 1_000, fees: 100, closedTrades: 2 }),
      row({
        tradeDate: '2026-11-11',
        realizedPnl: 1_621,
        fees: 329,
        closedTrades: 4,
      }),
    ]);

    await expect(
      service.dailyTotals('2026-11-10', '2026-11-11'),
    ).resolves.toEqual([
      { tradeDate: '2026-11-10', pnl: -2_500, fees: 1_000, closedTrades: 13 },
      { tradeDate: '2026-11-11', pnl: 1_621, fees: 329, closedTrades: 4 },
    ]);
    expect(positions.findDailyResults).toHaveBeenCalledWith({
      from: '2026-11-10',
      to: '2026-11-11',
    });
  });
});
