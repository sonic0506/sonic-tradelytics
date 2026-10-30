import { Suspense } from 'react';

import { QueryBoundary } from '@/shared/ui';

import { BotListContent, BotListContentSkeleton } from './bot-list-content';
import { BotListPrefetch } from './bot-list-prefetch';
import { BotListSummary, BotListSummarySkeleton } from './bot-list-summary';
import { BotListView } from './bot-list-view';

export function BotListPage() {
  return (
    <Suspense
      fallback={
        <BotListView
          summary={<BotListSummarySkeleton />}
          content={<BotListContentSkeleton />}
        />
      }
    >
      <BotListPrefetch>
        <BotListView
          summary={
            <QueryBoundary
              loading={<BotListSummarySkeleton />}
              errorTitle="봇 수를 불러오지 못했어요"
              errorFallback={null}
            >
              <BotListSummary />
            </QueryBoundary>
          }
          content={<BotListContent />}
        />
      </BotListPrefetch>
    </Suspense>
  );
}
