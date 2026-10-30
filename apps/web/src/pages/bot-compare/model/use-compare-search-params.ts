import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

import { botStageSchema } from '@/shared/api';

import { COMPARE_SORT_KEYS, SORT_DIRECTIONS } from '../lib/compare-sort';

// 기간·봇·단계와 정렬을 URL에 둬요
export function useCompareSearchParams() {
  return useQueryStates({
    from: parseAsString,
    to: parseAsString,
    botIds: parseAsArrayOf(parseAsString).withDefault([]),
    stage: parseAsStringLiteral(botStageSchema.options),
    sort: parseAsStringLiteral(COMPARE_SORT_KEYS).withDefault('returnRate'),
    dir: parseAsStringLiteral(SORT_DIRECTIONS).withDefault('desc'),
  });
}
