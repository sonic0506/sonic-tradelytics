import { parseAsArrayOf, parseAsString, useQueryStates } from 'nuqs';

// 기간과 봇을 URL에 둬요
export function useAccuracySearchParams() {
  return useQueryStates({
    from: parseAsString,
    to: parseAsString,
    botIds: parseAsArrayOf(parseAsString).withDefault([]),
  });
}
