import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { CompareContent } from './compare-content';

async function rowNames() {
  const table = await screen.findByRole('table', { name: '봇 비교' });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
}

describe('CompareContent', () => {
  it('기본은 수익률이 높은 봇부터 보여 주고 거래 없는 봇은 맨 아래예요', async () => {
    renderWithQuery(<CompareContent />);
    expect(await rowNames()).toEqual([
      '모멘텀 단타 A',
      '종가 베팅 B',
      '직접 거래',
      '스윙 추세 C',
      '단타 실험 E',
      '스캘핑 D',
    ]);
    expect(screen.getByText(/같은 기간 지수/)).toBeInTheDocument();
  });

  it('승률 머리글을 누르면 승률이 높은 봇부터 보여 줘요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<CompareContent />);
    await screen.findByRole('table', { name: '봇 비교' });
    await user.click(screen.getByRole('button', { name: '승률' }));
    expect((await rowNames())[0]).toBe('종가 베팅 B');
  });

  it('주소의 단계 조건으로 시작하면 그 단계 봇만 보여 줘요', async () => {
    renderWithQuery(<CompareContent />, { searchParams: '?stage=released' });
    expect(await rowNames()).toEqual(['모멘텀 단타 A', '스윙 추세 C']);
  });

  it('거래가 하나도 없으면 봇 만들기를 안내해요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/bot-stats'), () =>
        HttpResponse.json({ items: [], benchmark: null }),
      ),
    );
    renderWithQuery(<CompareContent />);
    expect(await screen.findByText('비교할 거래가 없어요')).toBeInTheDocument();
  });

  it('불러오지 못하면 다시 시도를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/bot-stats'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<CompareContent />);
    expect(
      await screen.findByText('봇 비교를 불러오지 못했어요'),
    ).toBeInTheDocument();
  });
});
