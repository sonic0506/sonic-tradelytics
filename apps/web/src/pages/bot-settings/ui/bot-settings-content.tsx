import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';

import { BotNotFound, botQueries } from '@/entities/bot';
import { getQueryClient, HttpError } from '@/shared/api';

import { BotSettingsBoundary } from './bot-settings-boundary';

const ignore = () => undefined;

// 주소의 봇 id로 상세와 규칙 값 버전을 서버에서 먼저 받아 넘겨요.
export async function BotSettingsContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.query(botQueries.detail(id)).catch(ignore),
    queryClient.query(botQueries.versions(id)).catch(ignore),
  ]);
  const detailError = queryClient.getQueryState(
    botQueries.detail(id).queryKey,
  )?.error;
  if (detailError instanceof HttpError && detailError.status === 404) {
    return <BotNotFound />;
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BotSettingsBoundary botId={id} />
    </HydrationBoundary>
  );
}
