import { Test } from '@nestjs/testing';

import { TelegramClient } from '@/infra/telegram/telegram.client.js';
import { type RiskEvent, RiskService } from '@/modules/risk/index.js';

import { NotificationService } from './notification.service.js';

describe('NotificationService', () => {
  const telegram = {
    isEnabled: vi.fn<TelegramClient['isEnabled']>(),
    send: vi.fn<TelegramClient['send']>(),
  };
  const risk = {
    findUnnotified: vi.fn<RiskService['findUnnotified']>(),
    markNotified: vi.fn<RiskService['markNotified']>(),
  };
  let service: NotificationService;

  const event = (fields: Partial<RiskEvent>): RiskEvent =>
    Object.assign(
      {
        id: 1,
        kind: 'kill_switch',
        botId: null,
        // 2026-10-29 10:05 KST
        occurredAt: new Date('2026-10-29T01:05:00Z'),
        detail: { commandId: 3 },
        notifiedAt: null,
      },
      fields,
    ) as RiskEvent;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    telegram.isEnabled.mockReturnValue(true);
    risk.findUnnotified.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: TelegramClient, useValue: telegram },
        { provide: RiskService, useValue: risk },
      ],
    }).compile();
    service = moduleRef.get(NotificationService);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it('알리지 않은 이벤트를 사람이 읽는 문장으로 보내고 알림 시각을 남겨요', async () => {
    risk.findUnnotified.mockResolvedValue([event({})]);

    await service.flush();

    expect(telegram.send).toHaveBeenCalledWith(
      [
        '[tradelytics] 킬 스위치 작동',
        '대상: 전체',
        '시각: 2026-10-29 10:05 (KST)',
        '내용: {"commandId":3}',
      ].join('\n'),
    );
    expect(risk.markNotified).toHaveBeenCalledWith(1);
  });

  it('봇 이벤트는 봇 번호를 보여 줘요', async () => {
    risk.findUnnotified.mockResolvedValue([
      event({ kind: 'bot_error', botId: 7 }),
    ]);

    await service.flush();

    expect(telegram.send.mock.calls[0]?.[0]).toContain('봇 오류');
    expect(telegram.send.mock.calls[0]?.[0]).toContain('대상: 봇 #7');
  });

  it('발송이 실패하면 거기서 멈추고 뒤 이벤트는 다음 주기에 보내요', async () => {
    risk.findUnnotified.mockResolvedValue([event({ id: 1 }), event({ id: 2 })]);
    telegram.send.mockRejectedValueOnce(new Error('telegram down'));

    await expect(service.flush()).resolves.toBeUndefined();

    expect(telegram.send).toHaveBeenCalledOnce();
    expect(risk.markNotified).not.toHaveBeenCalled();
  });

  it('시작하면 5초마다 보내요', async () => {
    service.start();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(risk.findUnnotified).toHaveBeenCalledTimes(2);
  });

  it('텔레그램 설정이 없으면 보내지 않아요', async () => {
    telegram.isEnabled.mockReturnValue(false);

    service.start();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(risk.findUnnotified).not.toHaveBeenCalled();
  });
});
