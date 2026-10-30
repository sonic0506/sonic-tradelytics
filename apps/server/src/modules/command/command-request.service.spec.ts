import { Test } from '@nestjs/testing';

import { type Bot, BotService } from '@/modules/bot/index.js';

import {
  noOpTransactionalModule,
  runInCls,
} from '../../../test/setup/transactional.js';
import { CommandRepository } from './command.repository.js';
import { CommandRequestService } from './command-request.service.js';
import type { CreateCommandDto } from './dto/create-command.dto.js';
import type { Command } from './entities/command.entity.js';

describe('CommandRequestService', () => {
  const commands = {
    add: vi.fn<CommandRepository['add']>(),
    findById: vi.fn<CommandRepository['findById']>(),
    notify: vi.fn<CommandRepository['notify']>(),
  };
  const bots = { findById: vi.fn<BotService['findById']>() };
  let service: CommandRequestService;
  let create: (request: CreateCommandDto) => Promise<Command>;
  const now = new Date('2026-10-30T01:00:00Z');

  const bot = (fields: Partial<Bot> = {}): Bot =>
    Object.assign(
      { id: 7, status: 'running', statusReason: null },
      fields,
    ) as Bot;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now, toFake: ['Date'] });
    commands.add.mockImplementation((fields) =>
      Promise.resolve(Object.assign({ id: 1 }, fields) as Command),
    );
    bots.findById.mockResolvedValue(bot());
    const moduleRef = await Test.createTestingModule({
      imports: [noOpTransactionalModule],
      providers: [
        CommandRequestService,
        { provide: CommandRepository, useValue: commands },
        { provide: BotService, useValue: bots },
      ],
    }).compile();
    service = moduleRef.get(CommandRequestService);
    create = (request) => runInCls(moduleRef, () => service.create(request));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('킬 스위치는 봇 없이 언제나 받고, 행을 넣은 뒤 engine에 알려요', async () => {
    await create({ kind: 'kill', liquidateAll: true });

    expect(bots.findById).not.toHaveBeenCalled();
    expect(commands.add).toHaveBeenCalledWith({
      kind: 'kill',
      botId: null,
      liquidateAll: true,
      budget: null,
      requestedAt: now,
    });
    expect(commands.notify).toHaveBeenCalledAfter(commands.add);
  });

  it('봇 명령은 봇 id를 숫자로 넣고, kill이 아니면 전량 청산 표시를 무시해요', async () => {
    await create({ kind: 'pause', botId: '7', liquidateAll: true });

    expect(commands.add).toHaveBeenCalledWith(
      expect.objectContaining({ botId: 7, liquidateAll: false }),
    );
  });

  it('rebudget은 새 투자금 설정을 같이 넣어요', async () => {
    await create({
      kind: 'rebudget',
      botId: '7',
      budget: { budgetType: 'fixed', budgetAmount: 200_000 },
    });

    expect(commands.add).toHaveBeenCalledWith(
      expect.objectContaining({
        budget: { budgetType: 'fixed', budgetAmount: 200_000 },
      }),
    );
  });

  it('없는 봇이면 404이고 아무것도 넣지 않아요', async () => {
    bots.findById.mockResolvedValue(null);

    await expect(create({ kind: 'pause', botId: '9' })).rejects.toMatchObject({
      code: 'BOT_NOT_FOUND',
    });
    expect(commands.add).not.toHaveBeenCalled();
    expect(commands.notify).not.toHaveBeenCalled();
  });

  it.each([
    ['pause', bot({ status: 'stopped' })],
    ['liquidate', bot({ status: 'stopped' })],
    ['resume', bot({ status: 'stopped', statusReason: 'total_stop' })],
    ['rebudget', bot({ status: 'ready' })],
    ['rebudget', bot({ status: 'waiting_funds' })],
  ] as const)('%s 명령은 이 봇 상태에서 409예요', async (kind, target) => {
    bots.findById.mockResolvedValue(target);

    await expect(create({ kind, botId: '7' })).rejects.toMatchObject({
      code: 'COMMAND_NOT_ALLOWED',
    });
    expect(commands.add).not.toHaveBeenCalled();
  });

  // 다시 돌릴지는 engine이 판단해요
  it('하루 한도로 멈춘 봇의 resume은 받아요', async () => {
    bots.findById.mockResolvedValue(
      bot({ status: 'paused', statusReason: 'daily_stop' }),
    );

    await create({ kind: 'resume', botId: '7' });

    expect(commands.add).toHaveBeenCalledOnce();
  });

  it('명령을 찾고, 없으면 404예요', async () => {
    const command = Object.assign({ id: 3 }) as Command;
    commands.findById
      .mockResolvedValueOnce(command)
      .mockResolvedValueOnce(null);

    await expect(service.find(3)).resolves.toBe(command);
    await expect(service.find(4)).rejects.toMatchObject({
      code: 'COMMAND_NOT_FOUND',
    });
  });
});
