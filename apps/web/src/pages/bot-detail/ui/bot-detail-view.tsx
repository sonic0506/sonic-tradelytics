'use client';

import { useBotQuery } from '@/entities/bot';
import { QueryBoundary } from '@/shared/ui';

import { BotDetailHeader } from './bot-detail-header';
import { BotDetailKpis } from './bot-detail-kpis';
import { BotFundsCard } from './bot-funds-card';
import { BotPnlTrendCard } from './bot-pnl-trend-card';
import {
  BotRecentTradesCard,
  BotRecentTradesCardSkeleton,
} from './bot-recent-trades-card';
import { BotRulesCard } from './bot-rules-card';
import { ReleaseCriteriaCard } from './release-criteria-card';
import { WaitingFundsNotice } from './waiting-funds-notice';

// 봇 상세 (Figma Bot Detail). 검증 중이면 손익 추이 옆에 상한 해제 기준을 둬요.
export function BotDetailView({ botId }: { botId: string }) {
  const { data: bot } = useBotQuery(botId);
  const isVerifying = bot.stage === 'verifying';
  return (
    <div className="flex flex-col gap-6">
      <BotDetailHeader bot={bot} />
      <WaitingFundsNotice bot={bot} />
      <BotDetailKpis bot={bot} />
      <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
        <div className={isVerifying ? 'lg:col-span-3' : 'lg:col-span-5'}>
          <BotPnlTrendCard bot={bot} />
        </div>
        {isVerifying && (
          <div className="lg:col-span-2">
            <ReleaseCriteriaCard bot={bot} />
          </div>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
        <div className="lg:col-span-3">
          <BotFundsCard bot={bot} />
        </div>
        <div className="lg:col-span-2">
          <BotRulesCard bot={bot} />
        </div>
      </div>
      <QueryBoundary
        loading={<BotRecentTradesCardSkeleton botId={bot.id} />}
        errorTitle="최근 거래를 불러오지 못했어요"
        isCompact
        isErrorInCard
      >
        <BotRecentTradesCard botId={bot.id} />
      </QueryBoundary>
    </div>
  );
}
