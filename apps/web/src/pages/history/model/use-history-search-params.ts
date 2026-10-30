import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

import {
  EXIT_REASONS,
  POSITION_RESULTS,
  POSITION_STATUSES,
} from '@/entities/position';

// 필터와 페이지는 URL에 둬요. 봇 상세의 "모두 보기"가 ?botIds=로 들어와요
export function useHistorySearchParams() {
  return useQueryStates({
    from: parseAsString,
    to: parseAsString,
    botIds: parseAsArrayOf(parseAsString).withDefault([]),
    symbol: parseAsString.withDefault(''),
    result: parseAsStringLiteral(POSITION_RESULTS),
    status: parseAsStringLiteral(POSITION_STATUSES),
    exitReason: parseAsStringLiteral(EXIT_REASONS),
    page: parseAsInteger.withDefault(1),
    size: parseAsInteger.withDefault(20),
  });
}
