import { useMutation, useQueryClient } from '@tanstack/react-query';

import { botQueries } from '@/entities/bot';

import { saveRuleVersion } from '../api/save-rule-version.api';

export function useSaveRuleVersionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveRuleVersion,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: botQueries.all() }),
  });
}
