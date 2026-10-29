import { describe, expect, it } from 'vitest';

import { BOTS_FIXTURE } from '../api/bot.mock';
import type { BotListItem } from '../model/bot.schema';
import {
  formatRunDay,
  getBudgetDetail,
  getStageDetail,
  getStageShort,
  getStatusDetail,
} from './bot-descriptions';

const NOW = Date.parse('2026-10-29T14:32:05+09:00');

function bot(id: string): BotListItem {
  const found = BOTS_FIXTURE.find((item) => item.id === id);
  if (!found) throw new Error(`fixture ${id} 없음`);
  return found;
}

describe('formatRunDay', () => {
  it('오늘과 내일은 낱말로, 그 뒤는 날짜와 요일로 써요', () => {
    expect(formatRunDay('2026-10-29T15:10:00+09:00', NOW)).toBe('오늘');
    expect(formatRunDay('2026-10-30T09:05:00+09:00', NOW)).toBe('내일');
    expect(formatRunDay('2026-11-02T09:05:00+09:00', NOW)).toBe('11/2(월)');
  });
});

describe('getStatusDetail', () => {
  it('실행 중이면 오늘 운영 상황을 보여 줘요', () => {
    expect(getStatusDetail(bot('bot-a'), NOW)).toBe('운영 중 · 15:15까지');
    expect(getStatusDetail(bot('bot-b'), NOW)).toBe(
      '쉬는 중 · 오늘 15:10 운영',
    );
  });

  it('멈췄거나 기다리면 이유를 보여 줘요', () => {
    expect(getStatusDetail(bot('bot-c'), NOW)).toBe('연속 손절 3회로 멈췄어요');
    expect(getStatusDetail(bot('bot-d'), NOW)).toBe('32,000원이 모자라요');
  });
});

describe('getStageDetail', () => {
  it('검증 중이면 통과한 기준 수와 상한을, 시작 전이면 상한만 보여 줘요', () => {
    expect(getStageDetail(bot('bot-b'))).toBe('기준 3/5 통과 · 상한 10만 원');
    expect(getStageDetail(bot('bot-d'))).toBe('시작 전 · 상한 10만 원');
    expect(getStageShort(bot('bot-b'))).toBe('검증 중 3/5');
  });

  it('상한 해제와 종료는 날짜를 보여 줘요', () => {
    expect(getStageDetail(bot('bot-a'))).toBe('2026-10-02 해제');
    expect(getStageDetail(bot('bot-e'))).toBe('2026-10-21 종료');
  });
});

describe('getBudgetDetail', () => {
  it('검증 중이면 설정값, 상한 해제면 방식, 종료면 반환을 보여 줘요', () => {
    expect(getBudgetDetail(bot('bot-b'))).toBe('설정 2,000,000원');
    expect(getBudgetDetail(bot('bot-a'))).toBe('정률 30%');
    expect(getBudgetDetail(bot('bot-c'))).toBe('정액');
    expect(getBudgetDetail(bot('bot-e'))).toBe('운용 자산으로 반환');
  });
});
