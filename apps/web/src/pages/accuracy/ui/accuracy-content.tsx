'use client';

import type { GetAccuracyStatsParams } from '@/entities/accuracy';
import { QueryBoundary } from '@/shared/ui';

import { useAccuracySearchParams } from '../model/use-accuracy-search-params';
import { AccuracyFilter, EMPTY_ACCURACY_FILTERS } from './accuracy-filter';
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

const ignore = () => undefined;

// 주소를 읽기 전 첫 로딩: 필터는 그대로 보여 주고 분석 자리만 Skeleton이에요
export function AccuracyContentSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <AccuracyFilter applied={EMPTY_ACCURACY_FILTERS} onApply={ignore} />
      <AccuracyReportSkeleton />
    </div>
  );
}
