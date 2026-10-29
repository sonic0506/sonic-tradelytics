import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { engineStatusQueries } from '@/entities/engine-status';
import { getQueryClient } from '@/shared/api';

// 엔진 상태를 서버에서 먼저 받아 넘겨요. 실패해도 화면은 그리고, 에러는 브라우저의 QueryBoundary가 받아요.
export async function EngineStatusHydration({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const queryClient = getQueryClient();
  await queryClient.query(engineStatusQueries.current()).catch(() => undefined);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
