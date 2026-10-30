import { http } from '@/shared/api';

// 판단에 쓰이지 않는 설정만 바꿔요. 투자금은 시작 전(ready·waiting_funds)에만 보내요 (api.md PATCH)
export type UpdateBotSettings = {
  botId: string;
  name?: string;
  periodEnd?: string | null;
  onPeriodEnd?: 'liquidate' | 'hold';
  startPriority?: number | null;
  tradingHours?: { start: string; end: string };
  budget?: { type: 'ratio' | 'fixed'; value: number };
  orderAmount?: number;
};

export async function updateBotSettings({ botId, ...body }: UpdateBotSettings) {
  await http<unknown>(`/v1/bots/${encodeURIComponent(botId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
