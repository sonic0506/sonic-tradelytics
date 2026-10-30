import { http } from '@/shared/api';

// 상한 해제 (FR-BOT-06). api가 기준을 다시 계산해 모두 통과할 때만 바꿔요(RELEASE_CRITERIA_NOT_MET).
export async function releaseBot(botId: string) {
  await http<unknown>(`/v1/bots/${encodeURIComponent(botId)}/release`, {
    method: 'POST',
  });
}
