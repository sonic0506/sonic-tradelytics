import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { BotListContent } from './bot-list-content';

// 테스트에는 Next App Router가 없어서 메뉴의 페이지 이동(useRouter)만 바꿔 끼워요(외부 모듈).
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// 데스크톱 표의 데이터 행 이름(머리글 행은 빼요). jsdom은 CSS를 적용하지 않아 표와 카드가 함께 그려져서 표로 좁혀요.
async function tableRowNames() {
  const table = await screen.findByRole('table', { name: '봇 목록' });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('link')[0]?.textContent);
}

describe('BotListContent', () => {
  it('기본은 오늘 손익이 큰 봇부터 보여 줘요', async () => {
    renderWithQuery(<BotListContent />);
    expect(await tableRowNames()).toEqual([
      '모멘텀 단타 A',
      '종가 베팅 B',
      '단타 실험 E',
      '스캘핑 D',
      '스윙 추세 C',
    ]);
  });

  it('봇 열 머리글을 누르면 이름순으로 정렬해요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotListContent />);
    await screen.findByRole('table', { name: '봇 목록' });
    await user.click(screen.getByRole('button', { name: '봇' }));
    await waitFor(async () => {
      expect((await tableRowNames())[0]).toBe('단타 실험 E');
    });
  });

  it('봇 이름을 입력하고 조회하면 그 봇만 남겨요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotListContent />);
    await screen.findByRole('table', { name: '봇 목록' });
    await user.type(screen.getByRole('textbox', { name: '봇 이름' }), '스윙');
    await user.click(screen.getByRole('button', { name: '조회하기' }));
    await waitFor(async () => {
      expect(await tableRowNames()).toEqual(['스윙 추세 C']);
    });
  });

  it('주소의 상태 조건으로 시작하면 그 상태만 보여 줘요', async () => {
    renderWithQuery(<BotListContent />, { searchParams: '?status=paused' });
    expect(await tableRowNames()).toEqual(['스윙 추세 C']);
  });

  it('조건에 맞는 봇이 없으면 필터를 초기화할 수 있어요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotListContent />, { searchParams: '?q=없는봇' });
    await user.click(
      await screen.findByRole('button', { name: '필터 초기화' }),
    );
    expect(await tableRowNames()).toHaveLength(5);
  });

  it('봇이 없으면 봇 만들기를 안내해요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/bots'), () =>
        HttpResponse.json({
          items: [],
          meta: { page: 1, size: 100, total: 0 },
        }),
      ),
    );
    renderWithQuery(<BotListContent />);
    expect(await screen.findByText('아직 봇이 없어요')).toBeInTheDocument();
  });

  it('목록을 불러오지 못하면 다시 시도를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/bots'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<BotListContent />);
    expect(
      await screen.findByText('봇 목록을 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument();
  });

  it('자금 대기 봇은 투자금을 줄여 다시 시작할 수 있어요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotListContent />);
    const table = await screen.findByRole('table', { name: '봇 목록' });
    await user.click(
      within(table).getByRole('button', { name: '스캘핑 D 더 보기' }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: '투자금 줄이고 다시 시작' }),
    );
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByRole('spinbutton', {
      name: '투자금 (원)',
    });
    expect(amount).toHaveValue(68_000);
    await user.click(within(dialog).getByRole('button', { name: '다시 시작' }));
    expect(
      await screen.findByText('투자금을 68,000원으로 줄이고 다시 시작했어요'),
    ).toBeInTheDocument();
  });

  it('쓸 수 있는 금액보다 크게 넣으면 고치는 방법을 알려 줘요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<BotListContent />);
    const table = await screen.findByRole('table', { name: '봇 목록' });
    await user.click(
      within(table).getByRole('button', { name: '스캘핑 D 더 보기' }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: '투자금 줄이고 다시 시작' }),
    );
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByRole('spinbutton', {
      name: '투자금 (원)',
    });
    await user.clear(amount);
    await user.type(amount, '90000');
    await user.click(within(dialog).getByRole('button', { name: '다시 시작' }));
    expect(
      await within(dialog).findByText('68,000원 이하로 입력해 주세요.'),
    ).toBeInTheDocument();
  });
});
