import { http } from '@/shared/api';

export type RebudgetBot = {
  botId: string;
  budget: { type: 'ratio' | 'fixed'; value: number; orderAmount: number };
};

// 쉬는 중인 봇의 투자금을 돌려받고 새 설정으로 다시 확정해요 (POL-FUND-12, 명령 rebudget)
export async function rebudgetBot({ botId, budget }: RebudgetBot) {
  await http<unknown>('/v1/commands', {
    method: 'POST',
    body: JSON.stringify({ kind: 'rebudget', botId, budget }),
  });
}
