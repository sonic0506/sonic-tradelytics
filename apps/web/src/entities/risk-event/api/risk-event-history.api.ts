import { http } from '@/shared/api';

import {
  type RiskEventKind,
  riskEventsSchema,
} from '../model/risk-event.schema';

export type GetRiskEventHistoryParams = {
  from: string | null;
  to: string | null;
  botIds: string[];
  kind: RiskEventKind | null;
  page: number;
  size: number;
};

// 운영 화면 리스크·장애 이벤트. 최신순, 페이지 나눔 (api.md 운영)
export async function getRiskEventHistory({
  from,
  to,
  botIds,
  kind,
  page,
  size,
}: GetRiskEventHistoryParams) {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (botIds.length > 0) query.set('botIds', botIds.join(','));
  if (kind) query.set('kinds', kind);
  return riskEventsSchema.parse(
    await http<unknown>(`/v1/risk-events?${query.toString()}`),
  );
}
