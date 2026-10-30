import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { HistoryContent } from './history-content';

describe('HistoryContent', () => {
  it('보유 중을 맨 위에 두고 그 밖의 거래를 이어서 보여 줘요', async () => {
    renderWithQuery(<HistoryContent />);
    const table = await screen.findByRole('table', { name: '투자 내역' });
    expect(within(table).getByText(/보유 중 6/)).toBeInTheDocument();
    expect(
      within(table).getByText('그 밖의 거래 · 최신 진입순'),
    ).toBeInTheDocument();
    expect(await screen.findByText('거래 수')).toBeInTheDocument();
  });

  it('펼치면 주문과 체결 합계를 보여 줘요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<HistoryContent />);
    await user.click(
      await screen.findByRole('button', { name: '한화오션 주문 펼치기' }),
    );
    const orders = await screen.findByRole('table', { name: '주문' });
    expect(within(orders).getByText('손절 조건')).toBeInTheDocument();
    expect(within(orders).getByText('보호 주문')).toBeInTheDocument();
  });

  it('주소의 봇 조건으로 시작하면 그 봇의 자금 요약과 거래만 보여 줘요', async () => {
    renderWithQuery(<HistoryContent />, { searchParams: '?botIds=bot-b' });
    expect(await screen.findByText('확정 투자금')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: '투자 내역' });
    expect(within(table).getByText('한화오션')).toBeInTheDocument();
    expect(within(table).queryByText('삼성전자')).not.toBeInTheDocument();
  });

  it('조건에 맞는 거래가 없으면 필터를 초기화할 수 있어요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<HistoryContent />, { searchParams: '?symbol=없는종목' });
    await user.click(
      await screen.findByRole('button', { name: '필터 초기화' }),
    );
    expect(
      await screen.findByRole('button', { name: '삼성전자 주문 펼치기' }),
    ).toBeInTheDocument();
  });

  it('거래가 하나도 없으면 봇 만들기를 안내해요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/positions'), () =>
        HttpResponse.json({
          items: [],
          meta: { page: 1, size: 20, total: 0 },
          quotedAt: null,
        }),
      ),
    );
    renderWithQuery(<HistoryContent />);
    expect(await screen.findByText('아직 거래가 없어요')).toBeInTheDocument();
  });

  it('내역을 불러오지 못하면 다시 시도를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/positions'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<HistoryContent />);
    expect(
      await screen.findByText('투자 내역을 불러오지 못했어요'),
    ).toBeInTheDocument();
  });
});
