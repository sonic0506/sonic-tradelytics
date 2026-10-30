import { describe, expect, it } from 'vitest';

import type { RuleField } from '@/entities/bot';

import { type BotDraft, INITIAL_DRAFT } from '../model/bot-draft';
import { getRatioExceededError, validateDraftStep } from './validate-bot-draft';

const FILLED: BotDraft = {
  ...INITIAL_DRAFT,
  name: '종가 베팅 B',
  budgetValue: '10',
  orderAmount: '100000',
  splitCount: '1',
  maxPositions: '1',
  periodStart: '2026-10-30',
  tradingStart: '15:10',
  tradingEnd: '15:20',
  rules: { gapStop: '-2', sellAt: '09:05' },
  firstLossPct: '-3',
  totalLossPct: '-10',
  stopStreak: '3',
};

const RULE_FIELDS: RuleField[] = [
  {
    key: 'gapStop',
    group: 'exit',
    label: '갭 하락 손절',
    kind: 'number',
    unit: '%',
    value: -2,
  },
  {
    key: 'sellAt',
    group: 'exit',
    label: '다음 날 매도 시각',
    kind: 'time',
    unit: null,
    value: '09:05',
  },
];

describe('validateDraftStep', () => {
  it('모든 단계를 채우면 통과해요', () => {
    for (const step of [1, 2, 3, 4]) {
      expect(validateDraftStep(step, FILLED, RULE_FIELDS)).toEqual({});
    }
  });

  it('이름이 비어 있으면 입력해 달라고 해요', () => {
    expect(validateDraftStep(1, { ...FILLED, name: '  ' }, [])).toEqual({
      name: '봇 이름을 입력해 주세요.',
    });
  });

  it('정률은 100%까지, 정액은 0보다 커야 해요', () => {
    const step = (patch: Partial<BotDraft>) =>
      validateDraftStep(2, { ...FILLED, ...patch }, []).budgetValue;
    expect(step({ budgetValue: '100' })).toBeUndefined();
    expect(step({ budgetValue: '100.5' })).toBe(
      '0보다 크고 100 이하인 %로 입력해 주세요.',
    );
    expect(step({ budgetType: 'fixed', budgetValue: '0' })).toBe(
      '0보다 큰 금액을 입력해 주세요.',
    );
  });

  it('운영 시간은 정규장 안이고 시작이 끝보다 앞이어야 해요', () => {
    const step = (patch: Partial<BotDraft>) =>
      validateDraftStep(2, { ...FILLED, ...patch }, []);
    expect(step({ tradingStart: '08:59' }).tradingStart).toBe(
      '09:00~15:30 안으로 입력해 주세요.',
    );
    expect(step({ tradingEnd: '15:31' }).tradingEnd).toBe(
      '09:00~15:30 안으로 입력해 주세요.',
    );
    expect(step({ tradingEnd: '15:10' }).tradingEnd).toBe(
      '운영 시작보다 뒤 시각으로 입력해 주세요.',
    );
  });

  it('종료일을 정하면 시작일과 같거나 뒤여야 해요', () => {
    const step = (periodEnd: string) =>
      validateDraftStep(2, { ...FILLED, isIndefinite: false, periodEnd }, [])
        .periodEnd;
    expect(step('2026-10-29')).toBe('시작일과 같거나 뒤 날짜로 골라 주세요.');
    expect(step('2026-10-30')).toBeUndefined();
  });

  it('규칙 값이 비면 그 칸에 알려 줘요', () => {
    const draft = { ...FILLED, rules: { gapStop: '', sellAt: '' } };
    expect(validateDraftStep(3, draft, RULE_FIELDS)).toEqual({
      'rule.gapStop': '숫자를 입력해 주세요.',
      'rule.sellAt': '시각을 입력해 주세요.',
    });
  });

  it('손실 한도는 0이 아니고 100% 이하예요', () => {
    const step = (patch: Partial<BotDraft>) =>
      validateDraftStep(4, { ...FILLED, ...patch }, []);
    expect(step({ firstLossPct: '0' }).firstLossPct).toBe(
      '0이 아니고 100 이하인 %로 입력해 주세요.',
    );
    expect(step({ totalLossPct: '10' }).totalLossPct).toBeUndefined();
  });
});

describe('getRatioExceededError', () => {
  it('합이 100% 이하면 문제가 없어요', () => {
    expect(getRatioExceededError(1, 70)).toBeNull();
  });

  it('넘으면 합계와 줄일 값을 알려 줘요', () => {
    expect(getRatioExceededError(1.1, 80)).toBe(
      '함께 시작하는 봇과 합쳐 110%예요. 70% 이하로 줄여 주세요.',
    );
  });

  it('다른 봇이 이미 100%를 쓰면 정액을 권해요', () => {
    expect(getRatioExceededError(1.2, 20)).toBe(
      '함께 시작하는 봇이 이미 100%를 쓰고 있어요. 정액으로 바꿔 주세요.',
    );
  });
});
