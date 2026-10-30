import { environmentManager, QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

import { HttpError } from './http';

const MAX_RETRY_COUNT = 3;

// 4xx(없는 봇 등)는 다시 불러도 같아서 바로 실패로 보여 줘요. 5xx·네트워크 오류만 다시 시도해요.
export function shouldRetry(failureCount: number, error: Error) {
  if (error instanceof HttpError && error.status < 500) return false;
  return failureCount < MAX_RETRY_COUNT;
}

// 서버에서 prefetch한 데이터를 hydration 직후 바로 다시 부르지 않게 staleTime을 둬요.
const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: shouldRetry } },
  });

// 서버는 요청마다 새 QueryClient(React cache로 한 요청 안에서는 같은 것), 브라우저는 하나만 써요.
const getServerQueryClient = cache(makeQueryClient);
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (environmentManager.isServer()) return getServerQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
