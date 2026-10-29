import type { RequestHandler } from 'msw';

import { botHandlers } from '@/entities/bot';
import { dailyResultHandlers } from '@/entities/daily-result';
import { engineStatusHandlers } from '@/entities/engine-status';
import { homeHandlers } from '@/entities/home';
import { orderHandlers } from '@/entities/order';
import { positionHandlers } from '@/entities/position';
import { riskEventHandlers } from '@/entities/risk-event';
import { killSwitchHandlers } from '@/features/engine/kill-switch';

// 각 slice의 api/*.mock.ts에서 만든 handler(index.ts로 export)를 app 레이어에서 모아요.
// shared는 entities를 모르기 때문에 여기서 모아요.
export const handlers: RequestHandler[] = [
  ...engineStatusHandlers,
  ...homeHandlers,
  ...botHandlers,
  ...dailyResultHandlers,
  ...positionHandlers,
  ...orderHandlers,
  ...riskEventHandlers,
  ...killSwitchHandlers,
];
