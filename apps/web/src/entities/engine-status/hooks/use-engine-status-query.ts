import { useSuspenseQuery } from '@tanstack/react-query';

import { engineStatusQueries } from '../api/engine-status.queries';
import { getEngineHealth } from '../lib/engine-health';

export function useEngineStatusQuery() {
  return useSuspenseQuery({
    ...engineStatusQueries.current(),
    select: (status) => ({
      ...status,
      health: getEngineHealth(status, Date.now()),
    }),
  });
}
