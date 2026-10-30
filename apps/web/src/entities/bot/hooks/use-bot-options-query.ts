import { useSuspenseQuery } from '@tanstack/react-query';

import { botQueries } from '../api/bot.queries';

// 목록 화면 필터의 봇 선택지. 끝난 봇도 들어 있어요.
export function useBotOptionsQuery() {
  return useSuspenseQuery(botQueries.options());
}
