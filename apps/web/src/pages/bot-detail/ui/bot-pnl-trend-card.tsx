'use client';

import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Text,
  ToggleGroup,
  ToggleGroupItem,
} from '@xonic0506/sonic-ui';
import { Inbox } from 'lucide-react';

import {
  type BotDetailView,
  PNL_PERIOD_LABEL,
  PNL_PERIODS,
  type PnlPeriod,
  useBotDailyResultsQuery,
} from '@/entities/bot';
import { formatMonthDay } from '@/shared/lib';
import {
  PnlBarChart,
  PnlLineChart,
  type PnlPoint,
  QueryBoundary,
} from '@/shared/ui';

import { useBotDetailSearchParams } from '../model/use-bot-detail-search-params';

function BotPnlCharts({
  bot,
  period,
}: {
  bot: BotDetailView;
  period: PnlPeriod;
}) {
  const { data } = useBotDailyResultsQuery(bot.id, period);
  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="아직 손익이 없어요"
        description={
          bot.status === 'waiting_funds'
            ? '투자금이 확정되고 첫 거래를 마치면 그래프를 그려요.'
            : '봇이 시작해 첫 거래를 마치면 그래프를 그려요.'
        }
      />
    );
  }

  const daily: PnlPoint[] = data.items.map((result) => ({
    key: result.tradeDate,
    label: formatMonthDay(result.tradeDate),
    pnl: result.pnl,
  }));
  // 누적 손익: 날짜순으로 더해 가요.
  const cumulative = daily.reduce<PnlPoint[]>(
    (points, point) => [
      ...points,
      { ...point, pnl: (points[points.length - 1]?.pnl ?? 0) + point.pnl },
    ],
    [],
  );
  // 실행 중·일시정지 봇은 오늘 막대를 오른쪽 끝에 더해요(오늘 행은 장후 배치 전이라 없어요).
  const isTrading = bot.status === 'running' || bot.status === 'paused';
  const bars = isTrading
    ? [...daily, { key: 'today', label: '오늘', pnl: bot.todayPnl }]
    : daily;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Text variant="caption" tone="muted">
          일별 손익
        </Text>
        <PnlBarChart points={bars} ariaLabel={`${bot.name} 일별 손익`} />
      </div>
      <div className="flex flex-col gap-2">
        <Text variant="caption" tone="muted">
          누적 손익
        </Text>
        <PnlLineChart points={cumulative} ariaLabel={`${bot.name} 누적 손익`} />
      </div>
    </div>
  );
}

// 손익 추이: 기간(1주·1개월·3개월·전체)을 바꿔 일별 막대와 누적 선을 봐요(FR-PERF-03).
export function BotPnlTrendCard({ bot }: { bot: BotDetailView }) {
  const [{ period }, setParams] = useBotDetailSearchParams();
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4 max-sm:flex-col">
        <CardHeader>
          <CardTitle>손익 추이</CardTitle>
          <CardDescription>수수료·세금을 뺀 금액이에요.</CardDescription>
        </CardHeader>
        <ToggleGroup
          aria-label="기간"
          value={period}
          onValueChange={(value) => {
            const next = PNL_PERIODS.find((candidate) => candidate === value);
            if (next) void setParams({ period: next });
          }}
        >
          {PNL_PERIODS.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {PNL_PERIOD_LABEL[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <CardBody>
        <QueryBoundary
          loading={<Skeleton shape="rect" className="h-80" />}
          errorTitle="손익 추이를 불러오지 못했어요"
          isCompact
        >
          <BotPnlCharts bot={bot} period={period} />
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}
