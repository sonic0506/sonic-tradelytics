import { QueryBoundary } from '@/shared/ui';

import { ActivityCard } from './activity-card';
import { DailyPnlCard } from './daily-pnl-card';
import { DailyPnlChart, DailyPnlChartSkeleton } from './daily-pnl-chart';
import { HoldingsCard, HoldingsCardSkeleton } from './holdings-card';
import { HomeBots, HomeBotsSkeleton } from './home-bots';
import { HomeHeaderMeta, HomeHeaderMetaSkeleton } from './home-header-meta';
import { HomeKpis, HomeKpisSkeleton } from './home-kpis';
import { HomeLayout } from './home-layout';
import { KillSwitchCard } from './kill-switch-card';
import {
  TodayOrdersTable,
  TodayOrdersTableSkeleton,
} from './today-orders-table';
import {
  TodayRiskEventList,
  TodayRiskEventListSkeleton,
} from './today-risk-event-list';

const ORDERS = {
  title: '오늘 체결',
  description: '봇이 낸 주문 중 체결된 것이에요.',
};
const RISK_EVENTS = {
  title: '리스크 이벤트',
  description: '한도에 닿거나 멈춘 기록이에요.',
};

// 카드마다 따로 불러와요. 하나가 실패해도 다른 카드와 긴급 정지는 그대로예요(api.md 홈).
export function HomeDashboard() {
  return (
    <HomeLayout
      headerMeta={
        <QueryBoundary
          loading={<HomeHeaderMetaSkeleton />}
          errorTitle="기준 시각을 불러오지 못했어요"
          errorFallback={null}
        >
          <HomeHeaderMeta />
        </QueryBoundary>
      }
      kpis={
        <QueryBoundary
          loading={<HomeKpisSkeleton />}
          errorTitle="홈 요약을 불러오지 못했어요"
          errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요. 긴급 정지는 그대로 쓸 수 있어요."
          isErrorInCard
        >
          <HomeKpis />
        </QueryBoundary>
      }
      dailyPnl={
        <DailyPnlCard>
          <QueryBoundary
            loading={<DailyPnlChartSkeleton />}
            errorTitle="일별 손익을 불러오지 못했어요"
            isCompact
          >
            <DailyPnlChart />
          </QueryBoundary>
        </DailyPnlCard>
      }
      killSwitch={<KillSwitchCard />}
      holdings={
        <QueryBoundary
          loading={<HoldingsCardSkeleton />}
          errorTitle="보유 종목을 불러오지 못했어요"
          isCompact
          isErrorInCard
        >
          <HoldingsCard />
        </QueryBoundary>
      }
      bots={
        <QueryBoundary
          loading={<HomeBotsSkeleton />}
          errorTitle="봇 현황을 불러오지 못했어요"
          isCompact
          isErrorInCard
        >
          <HomeBots />
        </QueryBoundary>
      }
      orders={
        <ActivityCard {...ORDERS}>
          <QueryBoundary
            loading={<TodayOrdersTableSkeleton />}
            errorTitle="오늘 체결을 불러오지 못했어요"
            isCompact
          >
            <TodayOrdersTable />
          </QueryBoundary>
        </ActivityCard>
      }
      riskEvents={
        <ActivityCard {...RISK_EVENTS}>
          <QueryBoundary
            loading={<TodayRiskEventListSkeleton />}
            errorTitle="리스크 이벤트를 불러오지 못했어요"
            isCompact
          >
            <TodayRiskEventList />
          </QueryBoundary>
        </ActivityCard>
      }
    />
  );
}

// 서버에서 데이터를 받는 동안 보여 줄 화면. 정상 화면과 같은 배치예요(DESIGN.md §8).
export function HomeSkeleton() {
  return (
    <HomeLayout
      headerMeta={<HomeHeaderMetaSkeleton />}
      kpis={<HomeKpisSkeleton />}
      dailyPnl={
        <DailyPnlCard>
          <DailyPnlChartSkeleton />
        </DailyPnlCard>
      }
      killSwitch={<KillSwitchCard />}
      holdings={<HoldingsCardSkeleton />}
      bots={<HomeBotsSkeleton />}
      orders={
        <ActivityCard {...ORDERS}>
          <TodayOrdersTableSkeleton />
        </ActivityCard>
      }
      riskEvents={
        <ActivityCard {...RISK_EVENTS}>
          <TodayRiskEventListSkeleton />
        </ActivityCard>
      }
    />
  );
}
