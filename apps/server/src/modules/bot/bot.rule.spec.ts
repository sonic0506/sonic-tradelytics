import {
  botActivity,
  isResting,
  isTradingHoursValid,
  nextRunDate,
  notRestingReasons,
  toTimeOfDay,
} from './bot.rule.js';

describe('bot.rule', () => {
  it('시각은 HH:mm·HH:mm:ss를 HH:mm:ss로 맞추고, 시각이 아니면 null이에요', () => {
    expect(toTimeOfDay('09:05')).toBe('09:05:00');
    expect(toTimeOfDay('15:20:30')).toBe('15:20:30');
    expect(toTimeOfDay('24:00')).toBeNull();
    expect(toTimeOfDay('9:05')).toBeNull();
  });

  it('운영 시간은 09:00~15:30 안이고 시작이 종료보다 앞이어야 해요', () => {
    expect(isTradingHoursValid('09:00:00', '15:30:00')).toBe(true);
    expect(isTradingHoursValid('08:50:00', '15:00:00')).toBe(false);
    expect(isTradingHoursValid('09:05:00', '15:31:00')).toBe(false);
    expect(isTradingHoursValid('10:00:00', '10:00:00')).toBe(false);
  });

  describe('오늘 운영 상황', () => {
    const state = {
      status: 'running',
      statusReason: null,
      isTradingDay: true,
      nowKst: '10:00:00',
      tradingStart: '09:05:00',
      tradingEnd: '15:20:00',
    };

    it('운영 시간 안이면 trading, 밖이면 off_hours예요', () => {
      expect(botActivity(state)).toBe('trading');
      expect(botActivity({ ...state, nowKst: '15:20:00' })).toBe('off_hours');
      expect(botActivity({ ...state, nowKst: '08:59:00' })).toBe('off_hours');
    });

    it('휴장일이 먼저이고, 하루 한도로 멈췄으면 limit_reached예요', () => {
      expect(botActivity({ ...state, isTradingDay: false })).toBe(
        'market_closed',
      );
      expect(
        botActivity({ ...state, status: 'paused', statusReason: 'daily_stop' }),
      ).toBe('limit_reached');
    });

    it('시작 전·자금 대기·종료 봇은 운영 상황이 없어요', () => {
      expect(botActivity({ ...state, status: 'ready' })).toBeNull();
      expect(botActivity({ ...state, status: 'stopped' })).toBeNull();
    });
  });

  it('보유·미체결·운영 시간 안이면 쉬는 중이 아니고 그 이유를 모두 줘요', () => {
    const reasons = notRestingReasons({
      status: 'running',
      activity: 'trading',
      hasHoldings: true,
      hasOpenOrders: true,
    });

    expect(reasons).toEqual(['holding', 'pending_order', 'trading_hours']);
    expect(isResting('running', reasons)).toBe(false);
  });

  it('장 마감 뒤 보유·미체결이 없으면 쉬는 중이고, 실행 중이 아니면 쉬는 중이 아니에요', () => {
    const reasons = notRestingReasons({
      status: 'paused',
      activity: 'off_hours',
      hasHoldings: false,
      hasOpenOrders: false,
    });

    expect(reasons).toEqual([]);
    expect(isResting('paused', reasons)).toBe(true);
    expect(isResting('ready', [])).toBe(false);
  });

  describe('다음 운영 날짜', () => {
    const state = {
      status: 'running',
      today: '2026-10-30',
      isTradingDay: true,
      nowKst: '08:00:00',
      tradingStart: '09:05:00',
      periodStart: '2026-10-01',
      nextOpenDate: '2026-11-02',
    };

    it('오늘 운영 시작 전이면 오늘, 지났거나 휴장이면 다음 개장일이에요', () => {
      expect(nextRunDate(state)).toBe('2026-10-30');
      expect(nextRunDate({ ...state, nowKst: '10:00:00' })).toBe('2026-11-02');
      expect(nextRunDate({ ...state, isTradingDay: false })).toBe('2026-11-02');
    });

    it('운용 시작일 전의 새 봇은 시작일, 끝난 봇은 null이에요', () => {
      expect(
        nextRunDate({ ...state, status: 'ready', periodStart: '2026-11-05' }),
      ).toBe('2026-11-05');
      expect(nextRunDate({ ...state, status: 'stopped' })).toBeNull();
    });
  });
});
