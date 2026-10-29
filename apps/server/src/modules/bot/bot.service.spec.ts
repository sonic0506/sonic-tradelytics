import { Test } from '@nestjs/testing';

import { BotRepository } from './bot.repository.js';
import { BotService } from './bot.service.js';

describe('BotService', () => {
  const bots = {
    findById: vi.fn<BotRepository['findById']>(),
    findByStatuses: vi.fn<BotRepository['findByStatuses']>(),
    setStatus: vi.fn<BotRepository['setStatus']>(),
    stopAll: vi.fn<BotRepository['stopAll']>(),
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

  it('상태 변경과 전체 정지는 repository에 그대로 넘겨요', async () => {
    await service.setStatus(7, 'paused', 'pause');
    await service.stopAll('kill_switch');
    await service.findById(7);

    expect(bots.setStatus).toHaveBeenCalledWith(7, 'paused', 'pause');
    expect(bots.stopAll).toHaveBeenCalledWith('kill_switch');
    expect(bots.findById).toHaveBeenCalledWith(7);
  });
});
