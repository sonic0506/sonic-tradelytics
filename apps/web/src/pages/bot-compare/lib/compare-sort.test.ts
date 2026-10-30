import { describe, expect, it } from 'vitest';

import type { BotStat } from '@/entities/bot';

import {
  formatAvgHold,
  getNextCompareSort,
  sortBotStats,
} from './compare-sort';

const row = (name: string, returnRate: number | null): BotStat => ({
  botId: name,
  name,
  stage: 'verifying',
  returnRate,
  netPnl: null,
  winRate: null,
  profitFactor: null,
  mdd: null,
  avgHoldMinutes: null,
  tradeCount: 0,
  cost: 0,
});

describe('sortBotStats', () => {
  it('값이 없는 봇은 어느 방향이든 맨 아래에 둬요', () => {
    const rows = [row('A', null), row('B', 2), row('C', -1)];
    expect(sortBotStats(rows, 'returnRate', 'desc').map((r) => r.name)).toEqual(
      ['B', 'C', 'A'],
    );
    expect(sortBotStats(rows, 'returnRate', 'asc').map((r) => r.name)).toEqual([
      'C',
      'B',
      'A',
    ]);
  });
});

describe('getNextCompareSort', () => {
  it('같은 열은 방향을 바꾸고 다른 열은 큰 값부터예요', () => {
    expect(
      getNextCompareSort(
        { key: 'returnRate', direction: 'desc' },
        'returnRate',
      ),
    ).toEqual({
      key: 'returnRate',
      direction: 'asc',
    });
    expect(
      getNextCompareSort({ key: 'returnRate', direction: 'asc' }, 'mdd'),
    ).toEqual({
      key: 'mdd',
      direction: 'desc',
    });
  });
});

describe('formatAvgHold', () => {
  it('보유 시간 길이에 맞는 단위로 써요', () => {
    expect(formatAvgHold(47)).toBe('47분');
    expect(formatAvgHold(1_060)).toBe('17시간 40분');
    expect(formatAvgHold(120)).toBe('2시간');
    expect(formatAvgHold(8_928)).toBe('6.2일');
  });
});
