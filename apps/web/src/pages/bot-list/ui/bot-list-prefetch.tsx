import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { botQueries } from '@/entities/bot';
import { getQueryClient } from '@/shared/api';

// 봇 목록을 서버에서 먼저 받아 넘겨요. 실패하면 브라우저에서 다시 불러 QueryBoundary가 받아요.
export async function BotListPrefetch({ children }: { children: ReactNode }) {
  await connection();
  const queryClient = getQueryClient();
  await queryClient.query(botQueries.list()).catch(() => undefined);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
