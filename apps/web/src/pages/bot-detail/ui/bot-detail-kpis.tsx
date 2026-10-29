'use client';

import { Card, Text } from '@xonic0506/sonic-ui';
import type { LucideIcon } from 'lucide-react';
import { Banknote, ChartColumn, ShieldCheck, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { type BotDetailView, getBudgetDetail } from '@/entities/bot';
import { formatSignedPercent, formatSignedWon, formatWon } from '@/shared/lib';
import { PnlText } from '@/shared/ui';

const DASH = '−';

function Kpi({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: ReactNode;
}) {
  return (
    <Card className="h-full flex-row items-start gap-3 whitespace-nowrap">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-subtle text-muted max-sm:hidden">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        {value}
        {detail}
      </div>
    </Card>
  );
}

function Detail({ children }: { children: ReactNode }) {
  return (
    <Text variant="mono-caption" tone="muted">
      {children}
    </Text>
  );
}

// 확정 투자금 · 오늘 손익 · 누적 손익 · 손실 중지까지 (Figma Bot Detail 위 네 칸)
export function BotDetailKpis({ bot }: { bot: BotDetailView }) {
  const isWaiting = bot.status === 'waiting_funds';
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi
        icon={Banknote}
        label="확정 투자금"
        value={
          <Text variant="title">
            {bot.budget === null ? DASH : formatWon(bot.budget)}
          </Text>
        }
        detail={
          <Detail>{isWaiting ? '자금 대기' : getBudgetDetail(bot)}</Detail>
        }
      />
      <Kpi
        icon={TrendingUp}
        label="오늘 손익"
        value={
          <PnlText value={bot.todayPnl} variant="title">
            {formatSignedWon(bot.todayPnl)}
          </PnlText>
        }
        detail={
          <PnlText value={bot.todayPnl} variant="mono-caption">
            {formatSignedPercent(bot.todayPnlRate)}
          </PnlText>
        }
      />
      <Kpi
        icon={ChartColumn}
        label="누적 손익"
        value={
          <PnlText value={bot.cumulativePnl} variant="title">
            {formatSignedWon(bot.cumulativePnl)}
          </PnlText>
        }
        detail={
          <PnlText value={bot.cumulativePnl} variant="mono-caption">
            {formatSignedPercent(bot.cumulativePnlRate)} · {bot.tradingDays}
            거래일
          </PnlText>
        }
      />
      <Kpi
        icon={ShieldCheck}
        label="손실 중지까지"
        value={
          <Text variant="title">
            {bot.lossStop ? formatWon(bot.lossStop.remaining) : DASH}
          </Text>
        }
        detail={
          <Detail>
            {bot.lossStop
              ? `누적 한도 ${DASH}${bot.lossStop.limitPercent}% 기준`
              : '시작 뒤 계산해요'}
          </Detail>
        }
      />
    </div>
  );
}
