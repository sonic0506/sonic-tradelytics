'use client';

import { Skeleton, Text } from '@xonic0506/sonic-ui';

import { useBotsQuery } from '@/entities/bot';

// 제목 아래 요약: "봇 5개 · 실행 중 2개예요."
export function BotListSummary() {
  const { data } = useBotsQuery();
  const runningCount = data.items.filter(
    (bot) => bot.status === 'running',
  ).length;
  return (
    <Text as="p" tone="muted">
      봇 {data.items.length}개 · 실행 중 {runningCount}개예요.
    </Text>
  );
}

export function BotListSummarySkeleton() {
  return <Skeleton shape="text" className="my-1 w-40" />;
}
