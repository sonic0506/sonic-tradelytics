import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { dailyResultQueries } from '@/entities/daily-result';
import { engineStatusQueries } from '@/entities/engine-status';
import { homeQueries } from '@/entities/home';
import { orderQueries } from '@/entities/order';
import { positionQueries } from '@/entities/position';
import { riskEventQueries } from '@/entities/risk-event';
import { getQueryClient } from '@/shared/api';

// 실패해도 화면은 그려요. 실패한 카드는 브라우저에서 다시 불러 각자의 ErrorBoundary가 받아요.
const ignore = () => undefined;

// 홈 카드가 쓰는 데이터를 서버에서 한 번에 받아 넘겨요(하네스 11절).
export async function HomePrefetch({ children }: { children: ReactNode }) {
  // 오늘 날짜로 부르는 쿼리가 있어서 요청 시점에 그려요.
  await connection();
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.query(homeQueries.summary()).catch(ignore),
    queryClient.query(dailyResultQueries.recent()).catch(ignore),
    queryClient.query(positionQueries.holdings()).catch(ignore),
    queryClient.query(orderQueries.todayRecent()).catch(ignore),
    queryClient.query(riskEventQueries.todayRecent()).catch(ignore),
    queryClient.query(engineStatusQueries.current()).catch(ignore),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
