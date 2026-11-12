import { positionView } from './position-view.rule.js';

describe('positionView', () => {
  it('열린 포지션은 수량이 있으면 보유 중, 0이면 미체결이에요', () => {
    expect(
      positionView({ status: 'open', quantity: 3, exitReason: null }),
    ).toBe('holding');
    expect(
      positionView({ status: 'open', quantity: 0, exitReason: null }),
    ).toBe('pending');
  });

  it('닫힌 포지션은 한 주도 체결되지 않았으면 취소, 아니면 청산 완료예요', () => {
    expect(
      positionView({ status: 'closed', quantity: 0, exitReason: 'not_filled' }),
    ).toBe('canceled');
    expect(
      positionView({ status: 'closed', quantity: 0, exitReason: 'stop_loss' }),
    ).toBe('closed');
  });
});
