import { useSuspenseQuery } from '@tanstack/react-query';

import { botQueries } from '../api/bot.queries';
import { getStatusDetail } from '../lib/bot-descriptions';

// 상태 아래 문구("쉬는 중 · 오늘 15:10 운영")는 지금 시각에 따라 바뀌어서 받을 때 함께 만들어요.
export function useBotsQuery() {
  return useSuspenseQuery({
    ...botQueries.list(),
    select: (response) => ({
      ...response,
      items: response.items.map((bot) => ({
        ...bot,
        statusDetail: getStatusDetail(bot, Date.now()),
      })),
    }),
  });
}

export type BotListRow = ReturnType<
  typeof useBotsQuery
>['data']['items'][number];
