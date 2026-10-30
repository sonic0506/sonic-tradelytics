'use client';

import { QueryBoundary } from '@/shared/ui';

import { PositionNotFound } from './position-not-found';
import { PositionRationaleSkeleton } from './position-rationale-skeleton';
import { PositionRationaleView } from './position-rationale-view';

// 없는 거래(404)는 페이지 에러, 그 밖의 실패는 다시 시도 (Figma Rationale / 에러)
export function PositionRationaleBoundary({
  positionId,
}: {
  positionId: string;
}) {
  return (
    <QueryBoundary
      loading={<PositionRationaleSkeleton />}
      errorTitle="근거 카드를 불러오지 못했어요"
      errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요."
      isErrorInCard
      notFoundFallback={<PositionNotFound />}
    >
      <PositionRationaleView positionId={positionId} />
    </QueryBoundary>
  );
}
