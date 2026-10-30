import { useMutation, useQueryClient } from '@tanstack/react-query';

import { botQueries } from '@/entities/bot';
import { homeQueries } from '@/entities/home';

import { rebudgetBot } from '../api/rebudget-bot.api';

export function useRebudgetBotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rebudgetBot,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: botQueries.all() }),
        queryClient.invalidateQueries({ queryKey: homeQueries.all() }),
      ]),
  });
}
