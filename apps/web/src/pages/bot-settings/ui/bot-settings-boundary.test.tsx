import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { BotSettingsBoundary } from './bot-settings-boundary';

// 테스트에는 Next App Router가 없어서 페이지 이동(useRouter)만 바꿔 끼워요(외부 모듈).
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('BotSettingsBoundary', () => {
  it('쉬는 중인 봇은 기본 설정·규칙 값·버전 기록과 함께 투자금을 다시 정할 수 있어요', async () => {
    renderWithQuery(<BotSettingsBoundary botId="bot-b" />);
    expect(
      await screen.findByRole('heading', { name: '봇 설정' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '봇 이름' })).toHaveValue(
      '종가 베팅 B',
    );
    expect(
      screen.getByText('지금은 쉬는 중이라 다시 정할 수 있어요'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '규칙 값 바꾸기' }),
    ).toHaveAttribute('href', '/bots/bot-b/rules');
    const table = await screen.findByRole('table', { name: '규칙 값 버전' });
    expect(within(table).getByText('처음 만든 값')).toBeInTheDocument();
  });

  it('보유 종목이 있으면 투자금을 다시 정할 수 없고 이유를 알려 줘요', async () => {
    renderWithQuery(<BotSettingsBoundary botId="bot-c" />);
    expect(
      await screen.findByText('지금은 다시 정할 수 없어요'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/NAVER 8주, 현대차 5주를 들고 있어요/),
    ).not.toHaveLength(0);
    expect(
      screen.getByRole('button', { name: '투자금 다시 정하기' }),
    ).toBeDisabled();
  });

  it('기본 설정을 저장하면 결과를 알려 줘요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotSettingsBoundary botId="bot-b" />);
    const name = await screen.findByRole('textbox', { name: '봇 이름' });
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(
      await screen.findByText('봇 이름을 입력해 주세요.'),
    ).toBeInTheDocument();
    await user.type(name, '종가 베팅 B2');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(
      await screen.findAllByText('기본 설정을 저장했어요'),
    ).not.toHaveLength(0);
  });

  it('투자금을 다시 정하면 결과를 알려 줘요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotSettingsBoundary botId="bot-b" />);
    await user.click(
      await screen.findByRole('button', { name: '투자금 다시 정하기' }),
    );
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByRole('spinbutton', {
      name: '투자금 (원)',
    });
    await user.clear(amount);
    await user.type(amount, '500000');
    expect(
      within(dialog).getByText(
        '500,000원으로 정해도 상한을 풀기 전에는 100,000원만 확정해요.',
      ),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: '다시 정하기' }),
    );
    expect(
      await screen.findAllByText('투자금을 다시 정했어요'),
    ).not.toHaveLength(0);
  });

  it('시작 전 봇은 투자금을 바로 고쳐 저장해요', async () => {
    renderWithQuery(<BotSettingsBoundary botId="bot-d" />);
    expect(
      await screen.findByRole('button', { name: '투자금 저장' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '투자금 다시 정하기' }),
    ).not.toBeInTheDocument();
  });

  it('없는 봇이면 봇 목록으로 안내해요', async () => {
    renderWithQuery(<BotSettingsBoundary botId="bot-x" />);
    expect(await screen.findByText('봇을 찾을 수 없어요')).toBeInTheDocument();
  });

  it('불러오지 못하면 다시 시도를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/bots/:id'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<BotSettingsBoundary botId="bot-b" />);
    expect(
      await screen.findByText('봇 설정을 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument();
  });
});
