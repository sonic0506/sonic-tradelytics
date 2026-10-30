import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';

import { OpsContent } from './ops-content';

describe('OpsContent', () => {
  it('리스크 이벤트와 알림 발송 여부를 보여 줘요', async () => {
    renderWithQuery(<OpsContent />);
    const table = await screen.findByRole('table', { name: '리스크 이벤트' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(within(table).getByText('보내지 않음')).toBeInTheDocument();
    expect(within(table).getByText('누적 한도')).toBeInTheDocument();
  });

  it('주소의 종류 조건으로 시작하면 그 종류만 보여 줘요', async () => {
    renderWithQuery(<OpsContent />, { searchParams: '?kind=order_rejected' });
    const table = await screen.findByRole('table', { name: '리스크 이벤트' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });

  it('조건에 맞는 기록이 없으면 필터를 초기화할 수 있어요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<OpsContent />, { searchParams: '?from=2027-01-01' });
    await user.click(
      await screen.findByRole('button', { name: '필터 초기화' }),
    );
    expect(
      await screen.findByRole('table', { name: '리스크 이벤트' }),
    ).toBeInTheDocument();
  });

  it('기록이 하나도 없으면 빈 상태를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/risk-events'), () =>
        HttpResponse.json({ items: [], meta: { page: 1, size: 20, total: 0 } }),
      ),
    );
    renderWithQuery(<OpsContent />);
    expect(
      await screen.findByText('리스크 이벤트가 없어요'),
    ).toBeInTheDocument();
  });

  it('불러오지 못하면 다시 시도를 보여 줘요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/risk-events'), () =>
        HttpResponse.json({ code: 'HTTP_500' }, { status: 500 }),
      ),
    );
    renderWithQuery(<OpsContent />);
    expect(
      await screen.findByText('운영 기록을 불러오지 못했어요'),
    ).toBeInTheDocument();
  });
});
