'use client';

import { BotNotFound } from '@/entities/bot';
import { QueryBoundary } from '@/shared/ui';

import { BotSettingsSkeleton } from './bot-settings-skeleton';
import { RuleEditView } from './rule-edit-view';

export function RuleEditBoundary({ botId }: { botId: string }) {
  return (
    <QueryBoundary
      loading={<BotSettingsSkeleton />}
      errorTitle="규칙 값을 불러오지 못했어요"
      errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요."
      isErrorInCard
      notFoundFallback={<BotNotFound />}
    >
      <RuleEditView botId={botId} />
    </QueryBoundary>
  );
}
