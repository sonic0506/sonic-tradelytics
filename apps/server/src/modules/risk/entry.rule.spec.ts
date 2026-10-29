import { entryBanReason, isTradingWindow } from './entry.rule.js';

describe('신규 진입 규칙', () => {
  const clean = {
    warnings: [],
    liquidationTrading: false,
    krxTradingSuspended: false,
    nxtTradingSuspended: null,
  };

  describe('진입 금지 (POL-RISK-06)', () => {
    it('유의사항과 거래 제한이 없으면 진입할 수 있어요', () => {
      expect(entryBanReason(clean)).toBeNull();
    });

    it.each([
      ['VI 발동', { warnings: ['VI_DYNAMIC'] }, 'vi'],
      ['투자경고', { warnings: ['INVESTMENT_WARNING'] }, 'market_alert'],
      ['단기과열', { warnings: ['OVERHEATED'] }, 'market_alert'],
      [
        '정리매매 유의사항',
        { warnings: ['LIQUIDATION_TRADING'] },
        'liquidation',
      ],
      ['정리매매 종목', { liquidationTrading: true }, 'liquidation'],
      ['KRX 거래정지', { krxTradingSuspended: true }, 'suspended'],
      ['NXT 거래정지', { nxtTradingSuspended: true }, 'suspended'],
      [
        '처음 보는 유의사항',
        { warnings: ['SOMETHING_NEW'] },
        'unknown_warning',
      ],
      ['신주인수권 표시', { warnings: ['STOCK_WARRANTS'] }, 'unknown_warning'],
    ])('%s 종목은 진입하지 않아요', (_, fields, reason) => {
      expect(entryBanReason({ ...clean, ...fields })).toBe(reason);
    });

    it('거래정지가 다른 사유보다 먼저예요', () => {
      expect(
        entryBanReason({
          ...clean,
          warnings: ['VI_STATIC'],
          krxTradingSuspended: true,
        }),
      ).toBe('suspended');
    });
  });

  describe('매매 시간 (POL-RISK-15)', () => {
    const window = { botStart: '09:05:00', botEnd: '15:15:00' };

    it('정규장이면서 봇 운영 시간 안일 때만 주문해요', () => {
      expect(
        isTradingWindow({
          ...window,
          isRegularSession: true,
          nowKst: '10:00:00',
        }),
      ).toBe(true);
    });

    it.each([
      ['운영 시작 전', true, '09:04:59'],
      ['운영 종료 시각', true, '15:15:00'],
      ['정규장이 아닌 날', false, '10:00:00'],
    ])('%s에는 주문하지 않아요', (_, isRegularSession, nowKst) => {
      expect(isTradingWindow({ ...window, isRegularSession, nowKst })).toBe(
        false,
      );
    });
  });
});
