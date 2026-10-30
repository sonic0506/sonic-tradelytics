import { useSuspenseQuery } from '@tanstack/react-query';

import { botQueries } from '../api/bot.queries';
import { getStatusDetail } from '../lib/bot-descriptions';

// 상태 문구는 지금 시각에 따라 바뀌어서 받을 때 함께 만들어요(useBotsQuery와 같아요).
export function useBotQuery(id: string) {
  return useSuspenseQuery({
    ...botQueries.detail(id),
    select: (bot) => ({
      ...bot,
      statusDetail: getStatusDetail(bot, Date.now()),
    }),
  });
}

export type BotDetailView = ReturnType<typeof useBotQuery>['data'];
