import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ENGINE_STATUS_FIXTURE } from '@/entities/engine-status';
import { mockApiUrl } from '@/shared/api';
import { renderWithQuery, server } from '@/shared/testing';
import { QueryBoundary } from '@/shared/ui';

import { EngineBanner } from './engine-banner';

function renderBanner() {
  return renderWithQuery(
    <QueryBoundary
      loading={<p>불러오는 중</p>}
      errorTitle="엔진 상태를 불러오지 못했어요"
    >
      <EngineBanner />
    </QueryBoundary>,
  );
}

describe('EngineBanner', () => {
  it('엔진이 전체 정지면 사유와 함께 경고를 보여 줘요', async () => {
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
    renderBanner();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '킬 스위치로 멈췄어요',
    );
  });

  it('heartbeat가 30초 넘게 오래되면 응답 없음을 알려요', async () => {
    server.use(
      http.get(mockApiUrl('/v1/engine-status'), () =>
        HttpResponse.json({
          ...ENGINE_STATUS_FIXTURE,
          heartbeatAt: new Date(Date.now() - 60_000).toISOString(),
        }),
      ),
    );
    renderBanner();
    expect(await screen.findByRole('status')).toHaveTextContent(
      '엔진 응답이 없어요',
    );
  });

  it('엔진이 정상이면 띠를 그리지 않아요', async () => {
    renderBanner();
    await waitForElementToBeRemoved(() => screen.queryByText('불러오는 중'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
