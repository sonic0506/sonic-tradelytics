'use client';

import type { GetPositionHistoryFilters } from '@/entities/position';
import { QueryBoundary } from '@/shared/ui';

import { useHistorySearchParams } from '../model/use-history-search-params';
import { EMPTY_HISTORY_FILTERS, HistoryFilter } from './history-filter';
import { HistoryList, HistoryListSkeleton } from './history-list';
import { HistorySummary, HistorySummarySkeleton } from './history-summary';

// 요약·필터·내역을 URL 필터 하나로 묶어요 (FR-PERF-04~07)
export function HistoryContent() {
  const [params, setParams] = useHistorySearchParams();
  const filters: GetPositionHistoryFilters = {
    from: params.from,
    to: params.to,
    botIds: params.botIds,
    symbol: params.symbol,
    result: params.result,
    status: params.status,
    exitReason: params.exitReason,
  };
  const hasFilters = Object.entries(filters).some(([, value]) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );
  const isOneBot =
    filters.botIds.length === 1 && filters.botIds[0] !== 'manual';

  const handleApply = (next: GetPositionHistoryFilters) => {
    void setParams({ ...next, symbol: next.symbol.trim(), page: 1 });
  };

  return (
    <div className="flex flex-col gap-6">
      <QueryBoundary
        loading={<HistorySummarySkeleton />}
        errorTitle="요약을 불러오지 못했어요"
        errorFallback={null}
      >
        <HistorySummary filters={filters} />
      </QueryBoundary>
      <HistoryFilter
        key={JSON.stringify(filters)}
        applied={filters}
        onApply={handleApply}
      />
      <QueryBoundary
        loading={<HistoryListSkeleton />}
        errorTitle="투자 내역을 불러오지 못했어요"
        errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요."
        isErrorInCard
      >
        <HistoryList
          params={params}
          hasFilters={hasFilters}
          isBotColumnVisible={!isOneBot}
          onPageChange={(next) => void setParams({ page: next })}
          onPageSizeChange={(next) => void setParams({ size: next, page: 1 })}
          onResetFilters={() => handleApply(EMPTY_HISTORY_FILTERS)}
        />
      </QueryBoundary>
    </div>
  );
}
