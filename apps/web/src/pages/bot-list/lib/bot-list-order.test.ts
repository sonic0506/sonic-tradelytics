import { describe, expect, it } from 'vitest';

import { BOTS_FIXTURE } from '@/entities/bot';

import { filterBots, getNextSort, sortBots } from './bot-list-order';

const names = (bots: { name: string }[]) => bots.map((bot) => bot.name);

describe('sortBots', () => {
  it('오늘 손익 내림차순이면 이익이 큰 봇부터, 같으면 이름순이에요', () => {
    expect(names(sortBots(BOTS_FIXTURE, 'pnl', 'desc'))).toEqual([
      '모멘텀 단타 A',
      '종가 베팅 B',
      '단타 실험 E',
      '스캘핑 D',
      '스윙 추세 C',
    ]);
  });

  it('상태는 실행 중 → 일시정지 → 자금 대기 → 종료 순서예요', () => {
    expect(names(sortBots(BOTS_FIXTURE, 'status', 'asc')).slice(2)).toEqual([
      '스윙 추세 C',
      '스캘핑 D',
      '단타 실험 E',
    ]);
  });
});

describe('filterBots', () => {
  it('이름·상태·단계를 모두 만족하는 봇만 남겨요', () => {
    const filtered = filterBots(BOTS_FIXTURE, {
      q: '단타',
      status: 'running',
      stage: null,
    });
    expect(names(filtered)).toEqual(['모멘텀 단타 A']);
  });
});

describe('getNextSort', () => {
  it('같은 열은 방향을 바꾸고, 새 숫자 열은 내림차순으로 시작해요', () => {
    expect(getNextSort({ key: 'pnl', direction: 'desc' }, 'pnl')).toEqual({
      key: 'pnl',
      direction: 'asc',
    });
    expect(getNextSort({ key: 'pnl', direction: 'desc' }, 'budget')).toEqual({
      key: 'budget',
      direction: 'desc',
    });
    expect(getNextSort({ key: 'pnl', direction: 'desc' }, 'name')).toEqual({
      key: 'name',
      direction: 'asc',
    });
  });
});
