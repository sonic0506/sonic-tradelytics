import { environmentManager, QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

// 서버에서 prefetch한 데이터를 hydration 직후 바로 다시 부르지 않게 staleTime을 둬요.
const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });

// 서버는 요청마다 새 QueryClient(React cache로 한 요청 안에서는 같은 것), 브라우저는 하나만 써요.
const getServerQueryClient = cache(makeQueryClient);
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (environmentManager.isServer()) return getServerQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
