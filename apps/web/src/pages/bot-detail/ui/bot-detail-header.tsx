'use client';

import { Badge, Text } from '@xonic0506/sonic-ui';

import {
  BOT_STAGE_LABEL,
  BotCharacter,
  type BotDetailView,
  BotStatusBadge,
} from '@/entities/bot';

import { getDetailMetaLine } from '../lib/bot-detail-text';
import { BotDetailActions } from './bot-detail-actions';

export function BotDetailHeader({ bot }: { bot: BotDetailView }) {
  return (
    <header className="flex items-start justify-between gap-4 max-md:flex-col">
      <div className="flex min-w-0 items-center gap-4">
        <BotCharacter type={bot.type} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Text as="h1" variant="display">
              {bot.name}
            </Text>
            <BotStatusBadge status={bot.status} />
            <Badge>{BOT_STAGE_LABEL[bot.stage]}</Badge>
          </div>
          <Text as="p" tone="muted">
            {getDetailMetaLine(bot)}
          </Text>
        </div>
      </div>
      <BotDetailActions bot={bot} />
    </header>
  );
}
