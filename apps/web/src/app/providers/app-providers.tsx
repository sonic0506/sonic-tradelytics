'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@xonic0506/sonic-ui';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { getQueryClient, holdRequests } from '@/shared/api';
import { env } from '@/shared/config';

import { UrlStateAdapter } from './url-state-adapter';

// 목 모드 브라우저에서는 MockStarter가 MSW를 켤 때까지 요청을 붙잡아 둬요.
// MockStarter는 늦게 불러와져서, 첫 렌더의 요청보다 먼저 도는 이 모듈에서 걸어요.
if (typeof window !== 'undefined' && env.NEXT_PUBLIC_API_MOCKING === 'true') {
  holdRequests();
}

// msw/browser는 서버 번들에서 풀리지 않아서 브라우저에서만 불러와요(ssr: false).
const MockStarter = dynamic(
  () => import('./mock-starter').then((module) => module.MockStarter),
  { ssr: false },
);

// 앱 전체 렌더 예외를 받는 마지막 경계예요. 데이터 블록의 에러는 page에서 따로 감싸요.
function AppErrorFallback() {
  return <p role="alert">화면을 그리지 못했어요. 새로고침해 주세요.</p>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <MockStarter />
      <UrlStateAdapter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </UrlStateAdapter>
    </ErrorBoundary>
  );
}
