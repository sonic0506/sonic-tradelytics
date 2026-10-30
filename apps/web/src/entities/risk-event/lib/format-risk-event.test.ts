import { describe, expect, it } from 'vitest';

import type { RiskEvent } from '../model/risk-event.schema';
import { formatRiskEventMessage } from './format-risk-event';

function riskEvent(
  kind: RiskEvent['kind'],
  detail: RiskEvent['detail'],
): RiskEvent {
  return {
    id: '1',
    botId: '1',
    botName: '모멘텀 단타 A',
    kind,
    occurredAt: '2026-10-29T13:05:00+09:00',
    detail,
    notifiedAt: null,
  };
}

describe('formatRiskEventMessage', () => {
  it('하루 한도는 투자금 대비 손익률과 함께 써요', () => {
    expect(
      formatRiskEventMessage(
        riskEvent('daily_stop', { amount: 3_000_000, dailyPnl: -93_000 }),
      ),
    ).toBe(
      '하루 손익 −93,000원(−3.1%)로 하루 손실 한도에 닿아 오늘 신규 진입을 멈췄어요.',
    );
  });

  it('detail에 값이 없으면 기본 문구만 써요', () => {
    expect(formatRiskEventMessage(riskEvent('total_stop', {}))).toBe(
      '누적 손실 한도에 닿아 봇을 끝냈어요.',
    );
  });

  it('연속 손절은 횟수를 써요', () => {
    expect(
      formatRiskEventMessage(riskEvent('streak_pause', { stopStreak: 3 })),
    ).toBe('3번 연속 손절해서 일시정지했어요. 재개는 직접 눌러야 해요.');
  });
});
