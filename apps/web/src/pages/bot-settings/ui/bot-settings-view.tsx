'use client';

import { Text } from '@xonic0506/sonic-ui';

import { useBotQuery } from '@/entities/bot';

import { getSettingsMetaLine } from '../lib/bot-settings-text';
import { BackLink } from './back-link';
import { BasicSettingsCard } from './basic-settings-card';
import { BudgetCard } from './budget-card';
import { RulesSummaryCard } from './rules-summary-card';
import { VersionHistoryCard } from './version-history-card';

// 봇 설정 (F1, Figma Bot Settings)
export function BotSettingsView({ botId }: { botId: string }) {
  const { data: bot } = useBotQuery(botId);
  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/bots/${encodeURIComponent(bot.id)}`} label={bot.name} />
      <header className="flex flex-col gap-1">
        <Text as="h1" variant="display">
          봇 설정
        </Text>
        <Text as="p" tone="muted">
          {getSettingsMetaLine(bot)}
        </Text>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-4">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <BasicSettingsCard key={bot.id} bot={bot} />
          <BudgetCard key={`${bot.id}-${bot.status}`} bot={bot} />
        </div>
        <RulesSummaryCard bot={bot} />
      </div>
      <VersionHistoryCard botId={bot.id} />
    </div>
  );
}
