import { Test, type TestingModule } from '@nestjs/testing';

import {
  noOpTransactionalModule,
  runInCls,
} from '../../../test/setup/transactional.js';
import { BotRepository } from './bot.repository.js';
import { BotService } from './bot.service.js';
import type { Bot } from './entities/bot.entity.js';
import type { BotVersion } from './entities/bot-version.entity.js';

describe('BotService', () => {
  const bots = {
    findById: vi.fn<BotRepository['findById']>(),
    findByStatuses: vi.fn<BotRepository['findByStatuses']>(),
    setStatus: vi.fn<BotRepository['setStatus']>(),
    stopAll: vi.fn<BotRepository['stopAll']>(),
    findByIds: vi.fn<BotRepository['findByIds']>(),
    findAppliedVersions: vi.fn<BotRepository['findAppliedVersions']>(),
    updateBudget: vi.fn<BotRepository['updateBudget']>(),
    findAllNames: vi.fn<BotRepository['findAllNames']>(),
    findStartingAt: vi.fn<BotRepository['findStartingAt']>(),
    createWithVersion: vi.fn<BotRepository['createWithVersion']>(),
  };
  let service: BotService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    moduleRef = await Test.createTestingModule({
      imports: [noOpTransactionalModule],
      providers: [BotService, { provide: BotRepository, useValue: bots }],
    }).compile();
    service = moduleRef.get(BotService);
  });

  it('신규 진입을 하지 않는 봇은 paused·waiting_funds·stopped예요', async () => {
    bots.findByStatuses.mockResolvedValue([]);

    await service.findInactive();

    expect(bots.findByStatuses).toHaveBeenCalledWith([
      'paused',
      'waiting_funds',
      'stopped',
    ]);
  });

  it('봇마다 적용된 버전 중 최신 버전을 붙여요', async () => {
    const bot7 = Object.assign({ id: 7 }) as Bot;
    const bot8 = Object.assign({ id: 8 }) as Bot;
    const latest = Object.assign({ botId: 7, version: 3 }) as BotVersion;
    const older = Object.assign({ botId: 7, version: 2 }) as BotVersion;
    bots.findByIds.mockResolvedValue([bot7, bot8]);
    bots.findAppliedVersions.mockResolvedValue([latest, older]);

    await expect(service.findWithVersions([7, 8])).resolves.toEqual([
      { bot: bot7, version: latest },
      { bot: bot8, version: null },
    ]);
  });

  it('봇이 없으면 조회하지 않고, 투자금 설정은 repository에 넘겨요', async () => {
    await expect(service.findWithVersions([])).resolves.toEqual([]);
    expect(bots.findByIds).not.toHaveBeenCalled();

    const budget = {
      budgetType: 'fixed' as const,
      budgetRatio: null,
      budgetAmount: 1,
    };
    await service.updateBudget(7, budget);
    expect(bots.updateBudget).toHaveBeenCalledWith(7, budget);
  });

  it('상태 변경과 전체 정지는 repository에 그대로 넘겨요', async () => {
    await service.setStatus(7, 'paused', 'pause');
    await service.stopAll('kill_switch');
    await service.findById(7);

    expect(bots.setStatus).toHaveBeenCalledWith(7, 'paused', 'pause');
    expect(bots.stopAll).toHaveBeenCalledWith('kill_switch');
    expect(bots.findById).toHaveBeenCalledWith(7);
  });

  it('투자금을 확정할 봇은 운용 시작일이 된 새 봇과 실행 중·자금 대기 봇이에요', async () => {
    const bot = (id: number, status: Bot['status'], periodStart: string) =>
      Object.assign({ id, status, periodStart }) as Bot;
    bots.findByStatuses.mockResolvedValue([
      bot(1, 'ready', '2026-10-30'),
      bot(2, 'ready', '2026-11-02'),
      bot(3, 'running', '2026-10-01'),
      bot(4, 'waiting_funds', '2026-11-02'),
    ]);

    const fundable = await service.findFundable('2026-10-30');

    expect(bots.findByStatuses).toHaveBeenCalledWith([
      'ready',
      'running',
      'waiting_funds',
    ]);
    expect(fundable.map(({ id }) => id)).toEqual([1, 3, 4]);
  });

  it('실행 중·일시정지 봇을 지금 버전과 함께 읽어요', async () => {
    const running = Object.assign({ id: 7 }) as Bot;
    bots.findByStatuses.mockResolvedValue([running]);
    bots.findByIds.mockResolvedValue([running]);
    bots.findAppliedVersions.mockResolvedValue([]);

    await expect(service.findTrading()).resolves.toEqual([
      { bot: running, version: null },
    ]);
    expect(bots.findByStatuses).toHaveBeenCalledWith(['running', 'paused']);
    expect(bots.findByIds).toHaveBeenCalledWith([7]);
  });

  describe('규칙 값과 봇 만들기', () => {
    it('저장된 규칙 값에 기본값을 채우고, 모르는 키나 틀린 모양은 필드와 함께 VALIDATION_FAILED예요', () => {
      expect(service.parseParams({ maxRank: 20 })).toMatchObject({
        maxRank: 20,
        minPrice: 1_000,
        exitAt: '15:15:00',
      });
      expect(() => service.parseParams({ maxRank: 'many' })).toThrow(
        expect.objectContaining({
          code: 'VALIDATION_FAILED',
          errors: [expect.objectContaining({ field: 'params.maxRank' })],
        }),
      );
      expect(() => service.parseParams({ turnoverSurge: 2 })).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    });

    it('화면 규칙 칸에 값을 붙이고 시각은 HH:mm으로 보여 줘요', () => {
      const fields = service.ruleFields(service.parseParams({}));

      expect(fields).toContainEqual({
        key: 'exitAt',
        group: 'exit',
        label: '장 마감 전 청산',
        kind: 'time',
        unit: null,
        value: '15:15',
      });
      expect(fields).toContainEqual(
        expect.objectContaining({ key: 'maxRank', unit: '위', value: 30 }),
      );
    });

    it('새 봇은 검증 중·시작 전(ready)으로 첫 버전과 함께 저장해요', async () => {
      const saved = Object.assign({ id: 5 }) as Bot;
      bots.createWithVersion.mockResolvedValue(saved);
      const fields = Object.assign({ name: 'day' }) as Parameters<
        BotService['create']
      >[0];
      const version = Object.assign({ maxPositions: 2 }) as Parameters<
        BotService['create']
      >[1];

      await expect(
        runInCls(moduleRef, () => service.create(fields, version)),
      ).resolves.toBe(saved);
      expect(bots.createWithVersion).toHaveBeenCalledWith(
        {
          name: 'day',
          stage: 'verifying',
          status: 'ready',
          statusReason: null,
        },
        version,
      );
    });

    it('선택 목록과 같은 시각 봇은 repository에서 읽어요', async () => {
      bots.findAllNames.mockResolvedValue([]);
      bots.findStartingAt.mockResolvedValue([]);

      await service.findOptions();
      await service.findStartingAt('09:05:00');

      expect(bots.findStartingAt).toHaveBeenCalledWith('09:05:00');
    });
  });
});
