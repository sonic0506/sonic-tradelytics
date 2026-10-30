'use client';

import type { GetAccuracyStatsParams } from '@/entities/accuracy';
import { QueryBoundary } from '@/shared/ui';

import { useAccuracySearchParams } from '../model/use-accuracy-search-params';
import { AccuracyFilter } from './accuracy-filter';
import { AccuracyReport, AccuracyReportSkeleton } from './accuracy-report';

export function AccuracyContent() {
  const [params, setParams] = useAccuracySearchParams();
  const filters: GetAccuracyStatsParams = {
    from: params.from,
    to: params.to,
    botIds: params.botIds,
  };
  return (
    <div className="flex flex-col gap-6">
      <AccuracyFilter
        key={JSON.stringify(filters)}
        applied={filters}
        onApply={(next) => void setParams(next)}
      />
      <QueryBoundary
        loading={<AccuracyReportSkeleton />}
        errorTitle="정확도 분석을 불러오지 못했어요"
        errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요."
        isErrorInCard
      >
        <AccuracyReport params={filters} />
      </QueryBoundary>
    </div>
  );
}
