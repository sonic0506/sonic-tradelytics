import { useMutation, useQueryClient } from '@tanstack/react-query';

import { botQueries } from '@/entities/bot';
import { homeQueries } from '@/entities/home';

import { createBotCommand } from '../api/control-bot.api';

export function useBotCommandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBotCommand,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: botQueries.all() }),
        queryClient.invalidateQueries({ queryKey: homeQueries.all() }),
      ]),
  });
}
