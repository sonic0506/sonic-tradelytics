import { http } from '@/shared/api';

export type RebudgetBot = {
  botId: string;
  // 정률이면 0~1, 정액이면 원
  budget: { type: 'ratio' | 'fixed'; value: number };
};

// 쉬는 중인 봇의 투자금을 돌려받고 새 설정으로 다시 확정해요 (POL-FUND-12, 명령 rebudget)
// 몸체는 서버 CommandBudgetDto예요. 1회 주문 금액은 바꾸지 않아서 보내지 않아요(엔진이 지금 값을 써요)
export async function rebudgetBot({ botId, budget }: RebudgetBot) {
  const body =
    budget.type === 'ratio'
      ? { budgetType: 'ratio', budgetRatio: budget.value }
      : { budgetType: 'fixed', budgetAmount: budget.value };
  await http<unknown>('/v1/commands', {
    method: 'POST',
    body: JSON.stringify({ kind: 'rebudget', botId, budget: body }),
  });
}
