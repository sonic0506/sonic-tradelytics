import { buttonVariants, Card, Text } from '@xonic0506/sonic-ui';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

import { BOT_TYPE_LABEL, BotCharacter, BotStatusBadge } from '@/entities/bot';
import type { HomeBot } from '@/entities/home';
import { formatRatio, formatSignedWon, formatWon } from '@/shared/lib';
import { PnlText } from '@/shared/ui';

import { Sparkline } from './sparkline';

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Text as="div" variant="caption" tone="muted">
        <dt>{label}</dt>
      </Text>
      <Text as="div" variant="mono">
        <dd className="m-0">{value}</dd>
      </Text>
    </div>
  );
}

// 확정 전(waiting_funds·ready)이면 설정값을 보여줘요(api.md 홈).
function formatBudget({ budget, budgetSetting }: HomeBot) {
  if (budget !== null) return formatWon(budget);
  return budgetSetting.type === 'fixed'
    ? formatWon(budgetSetting.value)
    : `정률 ${formatRatio(budgetSetting.value)}`;
}

export function HomeBotCard({ bot }: { bot: HomeBot }) {
  const meta = [
    BOT_TYPE_LABEL[bot.type],
    `v${bot.version}`,
    ...(bot.stage === 'verifying' ? ['검증 중'] : []),
  ].join(' · ');
  return (
    <Card className="h-full">
      <div className="flex items-center gap-3">
        <BotCharacter type={bot.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text as="h3" variant="body-strong" className="truncate">
            {bot.name}
          </Text>
          <Text variant="caption" tone="muted">
            {meta}
          </Text>
        </div>
        <BotStatusBadge status={bot.status} />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Text variant="caption" tone="muted">
            오늘 손익
          </Text>
          <PnlText value={bot.todayPnl} variant="title">
            {formatSignedWon(bot.todayPnl)}
          </PnlText>
        </div>
        <Sparkline values={bot.last7Days} />
      </div>
      <dl className="m-0 flex gap-6">
        <Stat label="오늘 체결" value={`${bot.todayFills}건`} />
        <Stat
          label="승률(30일)"
          value={bot.winRate30d === null ? '–' : formatRatio(bot.winRate30d)}
        />
        <Stat label="투자금" value={formatBudget(bot)} />
      </dl>
      <NextLink
        href={`/bots/${bot.id}`}
        aria-label={`${bot.name} 상세 보기`}
        // sonic-ui 0.6.2 buttonVariants는 border-transparent가 남아 secondary 테두리가 사라져요. border-default로 덮어써요.
        className={`${buttonVariants({ variant: 'secondary' })} w-full border-default`}
      >
        상세 보기
      </NextLink>
    </Card>
  );
}
