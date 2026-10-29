import { http } from '@/shared/api';

export type RestartWithBudget = { botId: string; amount: number };

// 자금 대기 봇: 투자금을 정액으로 줄여 저장하고(PATCH) 다시 시작 명령(resume)을 보내요(FR-BOT-10).
export async function restartWithBudget({ botId, amount }: RestartWithBudget) {
  await http<unknown>(`/v1/bots/${botId}`, {
    method: 'PATCH',
    body: JSON.stringify({ budget: { type: 'fixed', value: amount } }),
  });
  await http<unknown>('/v1/commands', {
    method: 'POST',
    body: JSON.stringify({ kind: 'resume', botId }),
  });
}
