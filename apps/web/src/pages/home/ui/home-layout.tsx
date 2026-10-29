import { buttonVariants, Text } from '@xonic0506/sonic-ui';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

type HomeLayoutProps = {
  headerMeta: ReactNode;
  kpis: ReactNode;
  dailyPnl: ReactNode;
  killSwitch: ReactNode;
  holdings: ReactNode;
  bots: ReactNode;
  orders: ReactNode;
  riskEvents: ReactNode;
};

// lg 이상은 Figma Desktop 배치예요. 그보다 좁으면 Mobile 순서
// (요약 → 긴급 정지 → 보유 종목 → 봇 → 일별 손익 → 체결 → 리스크)로 한 줄씩 쌓아요.
export function HomeLayout({
  headerMeta,
  kpis,
  dailyPnl,
  killSwitch,
  holdings,
  bots,
  orders,
  riskEvents,
}: HomeLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-2 max-lg:order-1">
        <div className="flex flex-col gap-1">
          <Text as="h1" variant="display">
            홈
          </Text>
          <Text as="p" tone="muted">
            오늘 봇과 계좌 상황이에요.
          </Text>
        </div>
        {headerMeta}
      </header>
      <div className="max-lg:order-2">{kpis}</div>
      <div className="max-lg:contents lg:grid lg:grid-cols-3 lg:gap-4">
        <div className="max-lg:order-6 lg:col-span-2">{dailyPnl}</div>
        <div className="max-lg:order-3">{killSwitch}</div>
      </div>
      <div className="max-lg:order-4">{holdings}</div>
      <section
        aria-labelledby="home-bots-title"
        className="flex flex-col gap-4 max-lg:order-5"
      >
        <div className="flex items-center justify-between gap-4">
          <Text as="h2" id="home-bots-title" variant="title">
            봇 현황
          </Text>
          <NextLink
            href="/bots"
            // sonic-ui 0.6.2 buttonVariants는 border-transparent가 남아 secondary 테두리가 사라져요. border-default로 덮어써요.
            className={`${buttonVariants({ variant: 'secondary', size: 'sm' })} border-default`}
          >
            봇 목록 보기
          </NextLink>
        </div>
        {bots}
      </section>
      <div className="grid gap-6 max-lg:order-7 lg:grid-cols-2 lg:gap-4">
        {orders}
        {riskEvents}
      </div>
    </div>
  );
}
