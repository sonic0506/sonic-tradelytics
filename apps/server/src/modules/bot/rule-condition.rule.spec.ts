import { ruleCondition } from './rule-condition.rule.js';

describe('ruleCondition', () => {
  it('규칙 id를 이름·기준·값으로 바꿔요', () => {
    expect(
      ruleCondition(
        { rule: 'price_min', value: 12_500, threshold: 5_000 },
        true,
      ),
    ).toEqual({
      label: '주가 하한',
      rule: '기준 5,000원 이상',
      value: '12,500원',
      passed: true,
    });
    expect(
      ruleCondition({ rule: 'exit_at', value: 545, threshold: 920 }, false),
    ).toMatchObject({ rule: '기준 15:20 이후', value: '09:05' });
  });

  it('모르는 규칙 id는 숫자 그대로 보여줘요', () => {
    expect(
      ruleCondition({ rule: 'new_rule', value: 3, threshold: 2 }, false),
    ).toEqual({
      label: 'new_rule',
      rule: '기준 2',
      value: '3',
      passed: false,
    });
  });
});
