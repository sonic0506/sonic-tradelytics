import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { BotCreatePage } from './bot-create-page';

// 테스트에는 Next App Router가 없어서 페이지 이동(useRouter)만 바꿔 끼워요(외부 모듈).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

type User = ReturnType<typeof userEvent.setup>;

async function fillTypeStep(user: User) {
  await user.click(screen.getByRole('radio', { name: /종가 베팅/ }));
  await user.type(
    screen.getByRole('textbox', { name: '봇 이름' }),
    '종가 베팅 B',
  );
  await user.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByText('모멘텀 단타 A');
}

async function goToLastStep(user: User) {
  await fillTypeStep(user);
  await user.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByRole('heading', { name: '규칙 값' });
  await user.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByText('만들 봇');
}

describe('BotCreatePage', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('이월 유형을 고르면 갭 하락 위험을 알려 줘요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotCreatePage />);
    expect(
      screen.queryByText('밤사이 갭 하락 위험이 있어요'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /종가 베팅/ }));
    expect(
      screen.getByText('밤사이 갭 하락 위험이 있어요'),
    ).toBeInTheDocument();
  });

  it('이름 없이 다음을 누르면 입력해 달라고 해요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotCreatePage />);
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(
      await screen.findByText('봇 이름을 입력해 주세요.'),
    ).toBeInTheDocument();
  });

  it('4단계를 채우고 만들면 새 봇 상세로 가요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotCreatePage />);
    await fillTypeStep(user);
    expect(screen.getByText('모멘텀 단타 A')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음' }));
    const highGap = await screen.findByRole('spinbutton', {
      name: '고가 대비 위치 (%)',
    });
    await user.clear(highGap);
    await user.type(highGap, '2');
    expect(screen.getByText('기본값 3%에서 바꿨어요.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('만들 봇')).toBeInTheDocument();
    expect(screen.getByText('1개')).toBeInTheDocument();
    expect(
      screen.getByText('3,000원을 잃으면 그 거래를 끝내요.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '봇 만들기' }));
    expect(await screen.findAllByText('봇을 만들었어요')).not.toHaveLength(0);
    expect(push).toHaveBeenCalledWith('/bots/bot-new');
  });

  it('함께 시작하는 정률 합이 100%를 넘으면 다음 단계로 가지 않아요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotCreatePage />);
    await fillTypeStep(user);
    const budget = screen.getByRole('spinbutton', { name: '투자금 (%)' });
    await user.clear(budget);
    await user.type(budget, '80');
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(
      await screen.findByText(
        '함께 시작하는 봇과 합쳐 110%예요. 70% 이하로 줄여 주세요.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '규칙 값' }),
    ).not.toBeInTheDocument();
  });

  it('서버가 운영 시간을 거절하면 이유를 알리고 그 단계로 돌아가요', async () => {
    server.use(
      http.post(mockApiUrl('/v1/bots'), () =>
        HttpResponse.json(
          { code: 'TRADING_HOURS_OUT_OF_RANGE' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<BotCreatePage />);
    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: '봇 만들기' }));
    expect(await screen.findAllByText('봇을 만들지 못했어요')).not.toHaveLength(
      0,
    );
    expect(await screen.findByText('모멘텀 단타 A')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('기본값을 불러오지 못하면 1단계에 남아 알려 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/bot-defaults'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<BotCreatePage />);
    await user.type(
      screen.getByRole('textbox', { name: '봇 이름' }),
      '데이 봇',
    );
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(
      await screen.findAllByText('기본값을 불러오지 못했어요'),
    ).not.toHaveLength(0);
    expect(
      screen.getByRole('textbox', { name: '봇 이름' }),
    ).toBeInTheDocument();
  });
});
