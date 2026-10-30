import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { PositionRationaleBoundary } from './position-rationale-boundary';

describe('PositionRationaleBoundary', () => {
  it('청산한 거래는 판단 근거와 채점 결과를 보여 줘요', async () => {
    renderWithQuery(<PositionRationaleBoundary positionId="cp-18" />);
    expect(
      await screen.findByRole('heading', { name: '한화오션' }),
    ).toBeInTheDocument();
    expect(screen.getByText('78점')).toBeInTheDocument();
    expect(screen.getAllByText('적중')).not.toHaveLength(0);
    expect(screen.getByText('17시간 47분')).toBeInTheDocument();
    expect(screen.getByText('장 마감 재평가 · 유지')).toBeInTheDocument();
  });

  it('보유 중인 거래는 아직 채점 전이라고 알려 줘요', async () => {
    renderWithQuery(<PositionRationaleBoundary positionId="pos-1" />);
    expect(await screen.findByText('아직 채점 전이에요')).toBeInTheDocument();
    expect(screen.getByText('평가 손익')).toBeInTheDocument();
  });

  it('직접 거래는 판단 기록이 없다고 알려 줘요', async () => {
    renderWithQuery(<PositionRationaleBoundary positionId="pos-2" />);
    expect(
      await screen.findByText('판단 기록이 없는 거래예요'),
    ).toBeInTheDocument();
  });

  it('없는 거래면 투자 내역으로 안내해요', async () => {
    renderWithQuery(<PositionRationaleBoundary positionId="pos-x" />);
    expect(
      await screen.findByText('거래를 찾을 수 없어요'),
    ).toBeInTheDocument();
  });

  it('불러오지 못하면 다시 시도를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/positions/:id'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<PositionRationaleBoundary positionId="cp-18" />);
    expect(
      await screen.findByText('근거 카드를 불러오지 못했어요'),
    ).toBeInTheDocument();
  });
});
