'use client';

import {
  buttonVariants,
  Card,
  EmptyState,
  Skeleton,
} from '@xonic0506/sonic-ui';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

import { useHomeSummaryQuery } from '@/entities/home';

import { HomeBotCard } from './home-bot-card';

function BotGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}

export function HomeBots() {
  const { data: home } = useHomeSummaryQuery();
  if (home.bots.length === 0) {
    return (
      <Card>
        <EmptyState
          title="아직 봇이 없어요"
          description="봇을 만들면 여기에서 오늘 손익을 볼 수 있어요."
          action={
            <NextLink href="/bots/new" className={buttonVariants()}>
              봇 만들기
            </NextLink>
          }
        />
      </Card>
    );
  }
  return (
    <BotGrid>
      {home.bots.map((bot) => (
        <HomeBotCard key={bot.id} bot={bot} />
      ))}
    </BotGrid>
  );
}

export function HomeBotsSkeleton() {
  return (
    <div aria-busy>
      <BotGrid>
        {[1, 2, 3, 4].map((card) => (
          <Card key={card}>
            <div className="flex items-center gap-3">
              <Skeleton shape="rect" className="size-16" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton shape="text" className="w-24" />
                <Skeleton shape="text" className="w-16" />
              </div>
            </div>
            <Skeleton shape="text" className="w-28" />
            <Skeleton shape="text" className="w-40" />
            <Skeleton shape="rect" className="h-8" />
          </Card>
        ))}
      </BotGrid>
    </div>
  );
}
