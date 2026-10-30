'use client';

import { QueryBoundary } from '@/shared/ui';

import { getNextCompareSort } from '../lib/compare-sort';
import { useCompareSearchParams } from '../model/use-compare-search-params';
import {
  CompareFilter,
  type CompareFilters,
  EMPTY_COMPARE_FILTERS,
} from './compare-filter';
import { CompareTable, CompareTableSkeleton } from './compare-table';

export function CompareContent() {
  const [params, setParams] = useCompareSearchParams();
  const filters: CompareFilters = {
    from: params.from,
    to: params.to,
    botIds: params.botIds,
    stage: params.stage,
  };
  const sort = { key: params.sort, direction: params.dir };
  const handleApply = (next: CompareFilters) => void setParams(next);

  return (
    <div className="flex flex-col gap-6">
      <CompareFilter
        key={JSON.stringify(filters)}
        applied={filters}
        onApply={handleApply}
      />
      <QueryBoundary
        loading={<CompareTableSkeleton />}
        errorTitle="봇 비교를 불러오지 못했어요"
        errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요."
        isErrorInCard
      >
        <CompareTable
          filters={filters}
          sort={sort}
          onSort={(key) => {
            const next = getNextCompareSort(sort, key);
            void setParams({ sort: next.key, dir: next.direction });
          }}
          onResetFilters={() => handleApply(EMPTY_COMPARE_FILTERS)}
        />
      </QueryBoundary>
    </div>
  );
}

const ignore = () => undefined;

// 주소를 읽기 전 첫 로딩: 필터는 그대로 보여 주고 표 자리만 Skeleton이에요
export function CompareContentSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <CompareFilter applied={EMPTY_COMPARE_FILTERS} onApply={ignore} />
      <CompareTableSkeleton />
    </div>
  );
}
