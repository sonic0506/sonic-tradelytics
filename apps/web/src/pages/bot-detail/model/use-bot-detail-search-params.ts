import { parseAsStringLiteral, useQueryStates } from 'nuqs';

import { PNL_PERIODS } from '@/entities/bot';

// 손익 추이 기간은 URL에 둬요(기본 1개월).
export function useBotDetailSearchParams() {
  return useQueryStates({
    period: parseAsStringLiteral(PNL_PERIODS).withDefault('1m'),
  });
}
