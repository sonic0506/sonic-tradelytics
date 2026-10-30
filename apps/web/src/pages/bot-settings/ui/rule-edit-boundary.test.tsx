import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '@/shared/testing';

import { RuleEditBoundary } from './rule-edit-boundary';

// 테스트에는 Next App Router가 없어서 페이지 이동(useRouter)만 바꿔 끼워요(외부 모듈).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

async function editRuleValue(label: string, value: string) {
  const user = userEvent.setup();
  renderWithQuery(<RuleEditBoundary botId="bot-b" />);
  const input = await screen.findByRole('spinbutton', { name: label });
  await user.clear(input);
  await user.type(input, value);
  return user;
}

describe('RuleEditBoundary', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('바꾼 값이 없으면 저장할 수 없어요', async () => {
    renderWithQuery(<RuleEditBoundary botId="bot-b" />);
    expect(await screen.findByText(/바꾼 값이 없어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'v2로 저장' })).toBeDisabled();
  });

  it('판단이 바뀌는 값을 바꾸면 검증 구간을 다시 시작한다고 알려 줘요', async () => {
    await editRuleValue('고가 대비 위치 (%)', '1.5');
    expect(
      await screen.findByText('판단이 바뀌는 변경이에요'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/적용할 때 투자금을 상한 100,000원으로 다시 확정해요/),
    ).toBeInTheDocument();
  });

  it('손실 한도만 조이면 검증 기록을 이어 간다고 알려 줘요', async () => {
    await editRuleValue('누적 손실 한도 (%)', '-8');
    expect(
      await screen.findByText('위험만 줄이는 변경이에요'),
    ).toBeInTheDocument();
  });

  it('저장하면 봇 설정으로 돌아가요', async () => {
    const user = await editRuleValue('고가 대비 위치 (%)', '1.5');
    await screen.findByText('판단이 바뀌는 변경이에요');
    await user.click(screen.getByRole('button', { name: 'v2로 저장' }));
    expect(
      await screen.findAllByText('규칙 값을 v2로 저장했어요'),
    ).not.toHaveLength(0);
    expect(push).toHaveBeenCalledWith('/bots/bot-b/settings');
  });
});
