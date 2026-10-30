import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';

import { BotNotFound, botQueries } from '@/entities/bot';
import { getQueryClient, HttpError } from '@/shared/api';

import { RuleEditBoundary } from './rule-edit-boundary';

const ignore = () => undefined;

export async function RuleEditContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  const queryClient = getQueryClient();
  await queryClient.query(botQueries.detail(id)).catch(ignore);
  const detailError = queryClient.getQueryState(
    botQueries.detail(id).queryKey,
  )?.error;
  if (detailError instanceof HttpError && detailError.status === 404) {
    return <BotNotFound />;
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RuleEditBoundary botId={id} />
    </HydrationBoundary>
  );
}
