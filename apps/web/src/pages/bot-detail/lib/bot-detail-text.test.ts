import { describe, expect, it } from 'vitest';

import { BOT_DETAILS_FIXTURE, type BotDetailView } from '@/entities/bot';

import { getDetailMetaLine, toParenthesized } from './bot-detail-text';

function view(id: string, statusDetail: string | null): BotDetailView {
  const bot = BOT_DETAILS_FIXTURE.find((item) => item.id === id);
  if (!bot) throw new Error(`fixture ${id} 없음`);
  return { ...bot, statusDetail };
}

describe('toParenthesized', () => {
  it('첫 낱말 뒤를 괄호로 묶어요', () => {
    expect(toParenthesized('쉬는 중 · 오늘 15:10 운영')).toBe(
      '쉬는 중(오늘 15:10 운영)',
    );
    expect(toParenthesized('연속 손절 3회로 멈췄어요')).toBe(
      '연속 손절 3회로 멈췄어요',
    );
  });
});

describe('getDetailMetaLine', () => {
  it('유형·성향·버전·시작일·오늘 운영 상황을 이어 써요', () => {
    expect(getDetailMetaLine(view('bot-b', '쉬는 중 · 오늘 15:10 운영'))).toBe(
      '종가 베팅 · 중립 · v1 · 2026-10-01 시작 · 쉬는 중(오늘 15:10 운영)',
    );
  });

  it('자금 대기면 언제부터 기다리는지 써요', () => {
    expect(getDetailMetaLine(view('bot-d', '32,000원이 모자라요'))).toBe(
      '스캘핑 · 소극적 · v1 · 10/29 09:00부터 자금 대기',
    );
  });
});
