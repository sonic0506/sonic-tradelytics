import { useSuspenseQuery } from '@tanstack/react-query';

import { botQueries } from '../api/bot.queries';
import type { PnlPeriod } from '../model/pnl-period';

export function useBotDailyResultsQuery(id: string, period: PnlPeriod) {
  return useSuspenseQuery(botQueries.dailyResults(id, period));
}
