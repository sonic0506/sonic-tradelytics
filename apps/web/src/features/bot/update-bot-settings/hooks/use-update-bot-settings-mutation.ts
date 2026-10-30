import { useMutation, useQueryClient } from '@tanstack/react-query';

import { botQueries } from '@/entities/bot';

import { updateBotSettings } from '../api/update-bot-settings.api';

export function useUpdateBotSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBotSettings,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: botQueries.all() }),
  });
}
