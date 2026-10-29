import { useMutation, useQueryClient } from '@tanstack/react-query';

import { botQueries } from '@/entities/bot';
import { homeQueries } from '@/entities/home';

import { releaseBot } from '../api/release-bot.api';

export function useReleaseBotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: releaseBot,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: botQueries.all() }),
        queryClient.invalidateQueries({ queryKey: homeQueries.all() }),
      ]),
  });
}
