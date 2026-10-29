import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

import { botStageSchema, botStatusSchema } from '@/shared/api';

import { BOT_SORT_KEYS, SORT_DIRECTIONS } from '../lib/bot-list-order';

// 필터와 정렬은 URL에 둬요. 새로고침하거나 주소를 보내도 같은 목록이 보여요.
export function useBotListSearchParams() {
  return useQueryStates({
    q: parseAsString.withDefault(''),
    status: parseAsStringLiteral(botStatusSchema.options),
    stage: parseAsStringLiteral(botStageSchema.options),
    sort: parseAsStringLiteral(BOT_SORT_KEYS).withDefault('pnl'),
    dir: parseAsStringLiteral(SORT_DIRECTIONS).withDefault('desc'),
  });
}
