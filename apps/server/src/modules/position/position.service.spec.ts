import { Test } from '@nestjs/testing';

import type { Position } from './entities/position.entity.js';
import { PositionNotFoundException } from './position.exception.js';
import { PositionRepository } from './position.repository.js';
import { PositionService } from './position.service.js';

describe('PositionService', () => {
  const positions = {
    findById: vi.fn<PositionRepository['findById']>(),
    findOpenManual: vi.fn<PositionRepository['findOpenManual']>(),
    createManual: vi.fn<PositionRepository['createManual']>(),
    update: vi.fn<PositionRepository['update']>(),
  };
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
});
