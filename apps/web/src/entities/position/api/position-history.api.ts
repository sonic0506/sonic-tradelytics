import { http } from '@/shared/api';

import {
  type GetPositionHistoryFilters,
  type GetPositionHistoryParams,
  positionDetailSchema,
  positionHistorySchema,
  positionSummarySchema,
} from '../model/position-history.schema';

function toQuery(filters: GetPositionHistoryFilters) {
  const query = new URLSearchParams();
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.botIds.length > 0) query.set('botIds', filters.botIds.join(','));
  if (filters.symbol.trim()) query.set('symbol', filters.symbol.trim());
  if (filters.result) query.set('result', filters.result);
  if (filters.status) query.set('status', filters.status);
  if (filters.exitReason) query.set('exitReasons', filters.exitReason);
  return query;
}

export async function getPositionHistory({
  page,
  size,
  ...filters
}: GetPositionHistoryParams) {
  const query = toQuery(filters);
  query.set('page', String(page));
  query.set('size', String(size));
  return positionHistorySchema.parse(
    await http<unknown>(`/v1/positions?${query.toString()}`),
  );
}

export async function getPositionSummary(filters: GetPositionHistoryFilters) {
  return positionSummarySchema.parse(
    await http<unknown>(
      `/v1/position-summaries?${toQuery(filters).toString()}`,
    ),
  );
}

export async function getPositionDetail(id: string) {
  return positionDetailSchema.parse(
    await http<unknown>(`/v1/positions/${encodeURIComponent(id)}`),
  );
}
