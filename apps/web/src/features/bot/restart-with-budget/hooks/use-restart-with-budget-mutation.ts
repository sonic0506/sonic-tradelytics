import { useMutation, useQueryClient } from '@tanstack/react-query';

import { botQueries } from '@/entities/bot';
import { homeQueries } from '@/entities/home';

import { restartWithBudget } from '../api/restart-with-budget.api';

export function useRestartWithBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restartWithBudget,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: botQueries.all() }),
        queryClient.invalidateQueries({ queryKey: homeQueries.all() }),
      ]),
  });
}
