import { Test } from '@nestjs/testing';

import { type Bot, BotService, type BotVersion } from '@/modules/bot/index.js';
import { QuoteQueryService } from '@/modules/market-data/index.js';

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
});
