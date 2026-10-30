import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

import { RISK_EVENT_KINDS } from '@/entities/risk-event';

// 기간·봇·종류와 페이지를 URL에 둬요
export function useOpsSearchParams() {
  return useQueryStates({
    from: parseAsString,
    to: parseAsString,
    botIds: parseAsArrayOf(parseAsString).withDefault([]),
    kind: parseAsStringLiteral(RISK_EVENT_KINDS),
    page: parseAsInteger.withDefault(1),
    size: parseAsInteger.withDefault(20),
  });
}
