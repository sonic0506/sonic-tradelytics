'use client';

import { Button, Card, Text } from '@xonic0506/sonic-ui';
import { useState } from 'react';

import type { BotDetailView } from '@/entities/bot';
import { RestartWithBudgetDialog } from '@/features/bot/restart-with-budget';
import { formatMonthDayTime, formatWon } from '@/shared/lib';

// 자금 대기 봇의 사유와 모자란 금액 (FR-BOT-10, Figma Bot Detail / 자금 대기)
export function WaitingFundsNotice({ bot }: { bot: BotDetailView }) {
  const [isOpen, setIsOpen] = useState(false);
  const shortfall = bot.fundShortfall;
  if (bot.status !== 'waiting_funds' || !shortfall) return null;
  const missing = shortfall.required - shortfall.available;
  const since = bot.waitingSince
    ? `${formatMonthDayTime(bot.waitingSince)}에 `
    : '';
  const requirement = bot.stage === 'verifying' ? '검증 상한' : '설정 금액';

  return (
    <Card className="flex-row items-center justify-between gap-4 border-warning bg-warning-subtle max-md:flex-col max-md:items-stretch">
      <div className="flex flex-col gap-1">
        <Text as="h2" variant="body-strong">
          자금이 모자라 시작하지 못했어요
        </Text>
        <Text as="p" variant="caption">
          {since}운용 자산을 나눴더니 {formatWon(missing)}이 모자랐어요.{' '}
          {requirement} {formatWon(shortfall.required)}이 필요한데 남은 운용
          자산은 {formatWon(shortfall.available)}이에요. 투자금을{' '}
          {formatWon(shortfall.available)} 이하로 줄이면 바로 시작해요.
        </Text>
      </div>
      <Button className="shrink-0" onClick={() => setIsOpen(true)}>
        투자금 줄이고 다시 시작
      </Button>
      <RestartWithBudgetDialog
        botId={bot.id}
        botName={bot.name}
        required={shortfall.required}
        available={shortfall.available}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </Card>
  );
}
