import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';

import { positionQueries } from '@/entities/position';
import { getQueryClient, HttpError } from '@/shared/api';

import { PositionNotFound } from './position-not-found';
import { PositionRationaleBoundary } from './position-rationale-boundary';

const ignore = () => undefined;

// 주소의 포지션 id로 근거 카드를 서버에서 먼저 받아 넘겨요.
export async function PositionRationaleContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  const queryClient = getQueryClient();
  await queryClient.query(positionQueries.detail(id)).catch(ignore);
  const error = queryClient.getQueryState(
    positionQueries.detail(id).queryKey,
  )?.error;
  if (error instanceof HttpError && error.status === 404) {
    return <PositionNotFound />;
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PositionRationaleBoundary positionId={id} />
    </HydrationBoundary>
  );
}
