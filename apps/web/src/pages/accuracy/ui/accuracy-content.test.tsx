import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { AccuracyContent } from './accuracy-content';

describe('AccuracyContent', () => {
  it('봇별 정확도와 점수 구간별 승률, 재평가 비교를 보여 줘요', async () => {
    renderWithQuery(<AccuracyContent />);
    const table = await screen.findByRole('table', { name: '봇별 정확도' });
    expect(within(table).getByText('종가 베팅 B')).toBeInTheDocument();
    expect(
      screen.getByRole('meter', { name: '90~100점 승률' }),
    ).toHaveAttribute('aria-valuenow', '78');
    expect(
      screen.getByText('재평가 뒤 예측이 8%p 더 맞았어요.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('진입 금지 종목 (VI·투자경고 등)'),
    ).toBeInTheDocument();
  });

  it('주소의 봇 조건으로 시작하면 그 봇만 보여 줘요', async () => {
    renderWithQuery(<AccuracyContent />, { searchParams: '?botIds=bot-b' });
    const table = await screen.findByRole('table', { name: '봇별 정확도' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });

  it('응답에 없는 섹션은 그리지 않아요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/accuracy-stats'), () =>
        HttpResponse.json({
          summary: {
            scoredCount: 1,
            directionHitRate: 1,
            targetReachRate: 1,
            bots: [],
          },
          scoreBuckets: [],
        }),
      ),
    );
    renderWithQuery(<AccuracyContent />);
    expect(
      await screen.findByText('신뢰 점수 구간별 승률'),
    ).toBeInTheDocument();
    expect(screen.queryByText('조건별 기여도')).not.toBeInTheDocument();
    expect(screen.queryByText('최초 판단 vs 재평가')).not.toBeInTheDocument();
  });

  it('채점한 거래가 없으면 빈 상태를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/accuracy-stats'), () =>
        HttpResponse.json({
          summary: {
            scoredCount: 0,
            directionHitRate: 0,
            targetReachRate: 0,
            bots: [],
          },
          scoreBuckets: [],
        }),
      ),
    );
    renderWithQuery(<AccuracyContent />);
    expect(await screen.findByText('채점한 거래가 없어요')).toBeInTheDocument();
  });

  it('불러오지 못하면 다시 시도를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/accuracy-stats'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<AccuracyContent />);
    expect(
      await screen.findByText('정확도 분석을 불러오지 못했어요'),
    ).toBeInTheDocument();
  });
});
