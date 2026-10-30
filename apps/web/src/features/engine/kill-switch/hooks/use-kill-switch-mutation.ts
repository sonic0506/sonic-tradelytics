import { useMutation, useQueryClient } from '@tanstack/react-query';

import { engineStatusQueries } from '@/entities/engine-status';
import { homeQueries } from '@/entities/home';

import { createKillCommand } from '../api/kill-switch.api';

// 킬 스위치는 engine이 처리해요. 보낸 뒤 엔진 상태와 봇 상태를 다시 불러와요.
export function useKillSwitchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKillCommand,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: engineStatusQueries.all() }),
        queryClient.invalidateQueries({ queryKey: homeQueries.all() }),
      ]),
  });
}
