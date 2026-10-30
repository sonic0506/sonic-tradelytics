import { Badge } from '@xonic0506/sonic-ui';

import type { BotStatus } from '@/shared/api';

import { BOT_STATUS_LABEL, BOT_STATUS_TONE } from '../model/bot-labels';

export function BotStatusBadge({ status }: { status: BotStatus }) {
  return (
    <Badge tone={BOT_STATUS_TONE[status]}>{BOT_STATUS_LABEL[status]}</Badge>
  );
}
