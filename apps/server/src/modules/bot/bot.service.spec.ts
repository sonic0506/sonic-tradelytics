import { Test } from '@nestjs/testing';

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
  };
  let service: BotService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
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
});
