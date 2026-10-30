import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ENGINE_STATUS_FIXTURE } from '@/entities/engine-status';
import { HOME_SUMMARY_FIXTURE } from '@/entities/home';
import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { HomeDashboard } from './home-dashboard';

const emptyList = { items: [], meta: { page: 1, size: 5, total: 0 } };

describe('HomeDashboard', () => {
  it('오늘 손익과 봇·보유 종목·체결·리스크 이벤트를 보여 줘요', async () => {
    renderWithQuery(<HomeDashboard />);
    expect(await screen.findByText('+81,842원')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: '모멘텀 단타 A' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'LG에너지솔루션' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('한화오션')).toBeInTheDocument();
    expect(
      await screen.findByText('스윙 추세 C가 3연속 손실로 일시정지했어요.'),
    ).toBeInTheDocument();
  });

  it('데이터가 없으면 영역마다 빈 상태를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/home'), () =>
        HttpResponse.json({
          ...HOME_SUMMARY_FIXTURE,
          todayPnl: { amount: 0, rate: 0 },
          botCounts: { running: 0, paused: 0, waitingFunds: 0, stopped: 0 },
          bots: [],
          fills: { total: 0, buy: 0, sell: 0 },
        }),
      ),
      http.get(mockApiUrl('/v1/daily-results'), () =>
        HttpResponse.json({ items: [] }),
      ),
      http.get(mockApiUrl('/v1/positions'), () => HttpResponse.json(emptyList)),
      http.get(mockApiUrl('/v1/orders'), () => HttpResponse.json(emptyList)),
      http.get(mockApiUrl('/v1/risk-events'), () =>
        HttpResponse.json(emptyList),
      ),
    );
    renderWithQuery(<HomeDashboard />);
    expect(await screen.findByText('아직 봇이 없어요')).toBeInTheDocument();
    expect(await screen.findByText('보유 종목이 없어요')).toBeInTheDocument();
    expect(
      await screen.findByText('손익 기록이 아직 없어요'),
    ).toBeInTheDocument();
    expect(await screen.findByText('오늘 체결이 없어요')).toBeInTheDocument();
    expect(
      await screen.findByText('리스크 이벤트가 없어요'),
    ).toBeInTheDocument();
    expect(await screen.findByText('아직 체결이 없어요')).toBeInTheDocument();
  });

  it('홈 요약을 불러오지 못해도 긴급 정지는 누를 수 있어요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/home'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<HomeDashboard />);
    expect(
      await screen.findByText('홈 요약을 불러오지 못했어요'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('봇 상태를 불러오지 못했어요.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: '모두 정지' }),
    ).toBeEnabled();
  });

  it('한 카드에서 다시 시도해 성공하면 같은 요청을 쓰는 카드도 함께 돌아와요', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        mockApiUrl('/v1/home'),
        () => HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
        { once: true },
      ),
    );
    renderWithQuery(<HomeDashboard />);
    await screen.findByText('홈 요약을 불러오지 못했어요');
    await screen.findByText('봇 현황을 불러오지 못했어요');
    const [retry] = screen.getAllByRole('button', { name: '다시 시도' });
    if (!retry) throw new Error('다시 시도 버튼이 없어요');
    await user.click(retry);
    await waitFor(() => {
      expect(
        screen.queryByText('봇 현황을 불러오지 못했어요'),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText('홈 요약을 불러오지 못했어요'),
    ).not.toBeInTheDocument();
  });

  it('긴급 정지를 확인하면 결과를 알려 줘요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<HomeDashboard />);
    // 엔진 상태를 받은 뒤의 버튼을 눌러요(받기 전 자리 버튼은 받은 뒤 바뀌어요)
    await screen.findByText('정규장');
    await user.click(screen.getByRole('button', { name: '모두 정지' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: '모두 정지' }));
    expect(await screen.findByText('모든 봇을 멈췄어요')).toBeInTheDocument();
  });

  it('엔진이 이미 전체 정지면 긴급 정지 버튼을 막아요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/engine-status'), () =>
        HttpResponse.json({
          ...ENGINE_STATUS_FIXTURE,
          state: 'halted',
          haltReasons: ['kill_switch'],
          heartbeatAt: new Date().toISOString(),
        }),
      ),
    );
    renderWithQuery(<HomeDashboard />);
    expect(
      await screen.findByRole('button', { name: '정지됨' }),
    ).toBeDisabled();
  });
});
