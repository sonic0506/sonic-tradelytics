import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { ToastProvider } from '@xonic0506/sonic-ui';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';

type Options = {
  // URL 상태(nuqs)의 시작 값. 예: { searchParams: '?page=2&q=kim' }
  searchParams?: string;
};

// 테스트마다 새 QueryClient(retry 없음)와 URL 상태 adapter로 감싸요.
// hasMemory: 테스트 중 URL을 바꾸는 동작(검색 입력, 페이지 이동)이 다음 렌더에 반영돼요.
// mutation 결과를 Toast로 알리는 화면이 있어서 ToastProvider도 둬요(앱의 AppProviders와 같아요).
export function renderWithQuery(ui: ReactNode, { searchParams }: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <NuqsTestingAdapter searchParams={searchParams ?? ''} hasMemory>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>,
  );
}
