import { useMutation, useQueryClient } from '@tanstack/react-query';

import { botQueries } from '@/entities/bot';
import { homeQueries } from '@/entities/home';

import { createBot } from '../api/create-bot.api';

export function useCreateBotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBot,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: botQueries.all() }),
        queryClient.invalidateQueries({ queryKey: homeQueries.all() }),
      ]),
  });
}
