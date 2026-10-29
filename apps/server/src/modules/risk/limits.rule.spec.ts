import {
  checkLossLimits,
  checkOrderRate,
  isPositionLossHit,
  isStopStreakHit,
  lossLimit,
} from './limits.rule.js';

describe('손실·주문 한도 규칙', () => {
  describe('손실 한도 (POL-RISK-01~03)', () => {
    it('투자금 10만 원, 하루 -3%면 3,000원 손실에서 멈춰요', () => {
      expect(lossLimit(100_000, 3)).toBe(3000);
      const base = {
        amount: 100_000,
        totalPnl: 0,
        dailyLossPct: 3,
        totalLossPct: 10,
      };

      expect(checkLossLimits({ ...base, dailyPnl: -2999 })).toBe('ok');
      expect(checkLossLimits({ ...base, dailyPnl: -3000 })).toBe('daily_stop');
    });

    it('누적 한도에 닿으면 하루 한도보다 먼저 봇 종료예요', () => {
      expect(
        checkLossLimits({
          amount: 100_000,
          dailyPnl: -5000,
          totalPnl: -10_000,
          dailyLossPct: 3,
          totalLossPct: 10,
        }),
      ).toBe('total_stop');
    });

    it('수익이면 한도에 닿지 않아요', () => {
      expect(
        checkLossLimits({
          amount: 100_000,
          dailyPnl: 5000,
          totalPnl: 20_000,
          dailyLossPct: 3,
          totalLossPct: 10,
        }),
      ).toBe('ok');
    });

    it('스윙은 종목당 매수 금액 대비 손실로 봐요', () => {
      expect(isPositionLossHit(200_000, -9999, 5)).toBe(false);
      expect(isPositionLossHit(200_000, -10_000, 5)).toBe(true);
      expect(isPositionLossHit(0, -1, 5)).toBe(false);
    });
  });

  describe('연속 손절 (POL-RISK-04)', () => {
    it('최근 3번이 모두 손절이면 일시 정지해요', () => {
      expect(
        isStopStreakHit(
          ['stop_loss', 'stop_loss', 'stop_loss', 'take_profit'],
          3,
        ),
      ).toBe(true);
    });

    it('중간에 다른 청산이 있거나 아직 3번이 안 되면 계속해요', () => {
      expect(
        isStopStreakHit(['stop_loss', 'take_profit', 'stop_loss'], 3),
      ).toBe(false);
      expect(isStopStreakHit(['stop_loss', 'stop_loss'], 3)).toBe(false);
    });
  });

  describe('주문 횟수 상한 (POL-RISK-08)', () => {
    const caps = { perBotPerMinute: 6, accountPerDay: 300 };

    it('봇의 1분 주문 수가 상한이면 이번 주문을 막아요', () => {
      expect(
        checkOrderRate(
          { botOrdersLastMinute: 5, accountOrdersToday: 10 },
          caps,
        ),
      ).toBe('ok');
      expect(
        checkOrderRate(
          { botOrdersLastMinute: 6, accountOrdersToday: 10 },
          caps,
        ),
      ).toBe('bot_rate');
    });

    it('계좌 일일 상한이 봇 상한보다 먼저예요', () => {
      expect(
        checkOrderRate(
          { botOrdersLastMinute: 6, accountOrdersToday: 300 },
          caps,
        ),
      ).toBe('account_daily');
    });

    it('상한을 넘기지 않으면 기본 상한으로도 통과해요', () => {
      expect(
        checkOrderRate({ botOrdersLastMinute: 0, accountOrdersToday: 0 }),
      ).toBe('ok');
    });
  });
});
