import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';

import { botQueries } from '@/entities/bot';
import { positionQueries } from '@/entities/position';
import { getQueryClient, HttpError } from '@/shared/api';

import { BotDetailBoundary } from './bot-detail-boundary';
import { BotNotFound } from './bot-not-found';

const ignore = () => undefined;

// 주소의 봇 id로 상세·손익 추이(기본 1개월)·최근 거래를 서버에서 먼저 받아 넘겨요.
export async function BotDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.query(botQueries.detail(id)).catch(ignore),
    queryClient.query(botQueries.dailyResults(id, '1m')).catch(ignore),
    queryClient.query(positionQueries.recentClosed(id)).catch(ignore),
  ]);
  // 없는 봇이면 브라우저에서 다시 부르지 않고 서버에서 바로 404 화면을 그려요.
  const detailError = queryClient.getQueryState(
    botQueries.detail(id).queryKey,
  )?.error;
  if (detailError instanceof HttpError && detailError.status === 404) {
    return <BotNotFound />;
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BotDetailBoundary botId={id} />
    </HydrationBoundary>
  );
}
