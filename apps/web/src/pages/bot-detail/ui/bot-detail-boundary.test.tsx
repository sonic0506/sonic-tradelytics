import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { BOT_DETAILS_FIXTURE } from '@/entities/bot';
import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { BotDetailBoundary } from './bot-detail-boundary';

describe('BotDetailBoundary', () => {
  it('봇 이름과 상한 해제 기준, 최근 거래를 보여 줘요', async () => {
    renderWithQuery(<BotDetailBoundary botId="bot-b" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: '종가 베팅 B' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('기준 2개가 남았어요. 모두 통과하면 알려 드려요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '상한 해제' })).toBeDisabled();
    const trades = await screen.findByRole('table', { name: '최근 거래' });
    expect(
      within(trades).getByRole('link', { name: '한화오션' }),
    ).toBeInTheDocument();
  });

  it('기준을 모두 통과하면 상한을 풀 수 있어요', async () => {
    const bot = BOT_DETAILS_FIXTURE.find((item) => item.id === 'bot-b');
    server.use(
      http.get(mockApiUrl('/v1/bots/:id'), () =>
        HttpResponse.json({
          ...bot,
          releaseCriteria: bot?.releaseCriteria.map((criterion) => ({
            ...criterion,
            passed: true,
          })),
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<BotDetailBoundary botId="bot-b" />);
    await user.click(await screen.findByRole('button', { name: '상한 해제' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: '상한 해제' }));
    expect(
      await screen.findByText('종가 베팅 B의 상한을 풀었어요'),
    ).toBeInTheDocument();
  });

  it('자금 대기 봇은 모자란 금액과 다시 시작 방법을 알려 줘요', async () => {
    renderWithQuery(<BotDetailBoundary botId="bot-d" />);
    expect(
      await screen.findByRole('heading', {
        name: '자금이 모자라 시작하지 못했어요',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '투자금 줄이고 다시 시작' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('아직 손익이 없어요')).toBeInTheDocument();
    expect(await screen.findByText('청산한 거래가 없어요')).toBeInTheDocument();
  });

  it('없는 봇이면 봇 목록으로 안내해요', async () => {
    renderWithQuery(<BotDetailBoundary botId="bot-x" />);
    expect(await screen.findByText('봇을 찾을 수 없어요')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '봇 목록으로 가기' }),
    ).toHaveAttribute('href', '/bots');
  });

  it('주소의 봇 id에 경로 문자가 있어도 다른 API로 가지 않고 없는 봇으로 보여 줘요', async () => {
    renderWithQuery(<BotDetailBoundary botId="../engine-status" />);
    expect(await screen.findByText('봇을 찾을 수 없어요')).toBeInTheDocument();
  });

  it('봇 정보를 불러오지 못하면 다시 시도를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/bots/:id'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<BotDetailBoundary botId="bot-b" />);
    expect(
      await screen.findByText('봇 정보를 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument();
  });
});
