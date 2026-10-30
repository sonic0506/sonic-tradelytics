'use client';

import { QueryBoundary } from '@/shared/ui';

import { useOpsSearchParams } from '../model/use-ops-search-params';
import { EMPTY_OPS_FILTERS, OpsFilter, type OpsFilters } from './ops-filter';
import { RiskEventList, RiskEventListSkeleton } from './risk-event-list';

export function OpsContent() {
  const [params, setParams] = useOpsSearchParams();
  const filters: OpsFilters = {
    from: params.from,
    to: params.to,
    botIds: params.botIds,
    kind: params.kind,
  };
  const hasFilters = Boolean(
    filters.from || filters.to || filters.kind || filters.botIds.length > 0,
  );
  const handleApply = (next: OpsFilters) =>
    void setParams({ ...next, page: 1 });

  return (
    <div className="flex flex-col gap-6">
      <OpsFilter
        key={JSON.stringify(filters)}
        applied={filters}
        onApply={handleApply}
      />
      <QueryBoundary
        loading={<RiskEventListSkeleton />}
        errorTitle="운영 기록을 불러오지 못했어요"
        errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요."
        isErrorInCard
      >
        <RiskEventList
          params={params}
          hasFilters={hasFilters}
          onPageChange={(page) => void setParams({ page })}
          onPageSizeChange={(size) => void setParams({ size, page: 1 })}
          onResetFilters={() => handleApply(EMPTY_OPS_FILTERS)}
        />
      </QueryBoundary>
    </div>
  );
}
