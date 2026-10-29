'use client';

import { Text } from '@xonic0506/sonic-ui';
import type { ReactNode } from 'react';

import { type BotListRow, BotStatusBadge, getStageShort } from '@/entities/bot';
import { formatSignedPercent, formatSignedWon, formatWon } from '@/shared/lib';
import { PnlText } from '@/shared/ui';

import { BotName } from './bot-name';
import { BotRowMenu } from './bot-row-menu';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Text as="div" variant="caption" tone="muted">
        <dt>{label}</dt>
      </Text>
      <dd className="m-0 flex flex-col">{children}</dd>
    </div>
  );
}

// 좁은 화면 봇 목록 (Figma Bot List — Mobile). 정렬은 위의 정렬 Select로 해요.
export function BotCardList({ bots }: { bots: BotListRow[] }) {
  return (
    <ul aria-label="봇 목록" className="m-0 flex list-none flex-col p-0">
      {bots.map((bot) => (
        <li
          key={bot.id}
          className="flex flex-col gap-3 border-b border-default p-4 last:border-b-0"
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <BotName bot={bot} />
            </div>
            <BotStatusBadge status={bot.status} />
            <BotRowMenu bot={bot} />
          </div>
          {bot.statusDetail && (
            <Text variant="caption" tone="muted">
              {bot.statusDetail}
            </Text>
          )}
          <dl className="m-0 grid grid-cols-3 gap-2">
            <Stat label="투자금">
              <Text variant="mono">{formatWon(bot.budget ?? 0)}</Text>
            </Stat>
            <Stat label="오늘 손익">
              <PnlText value={bot.todayPnl}>
                {formatSignedWon(bot.todayPnl)}
              </PnlText>
              <PnlText value={bot.todayPnl} variant="mono-caption">
                {formatSignedPercent(bot.todayPnlRate)}
              </PnlText>
            </Stat>
            <Stat label="단계">
              <Text>{getStageShort(bot)}</Text>
            </Stat>
          </dl>
        </li>
      ))}
    </ul>
  );
}
