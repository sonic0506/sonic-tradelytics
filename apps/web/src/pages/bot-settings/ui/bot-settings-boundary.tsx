'use client';

import { BotNotFound } from '@/entities/bot';
import { QueryBoundary } from '@/shared/ui';

import { BotSettingsSkeleton } from './bot-settings-skeleton';
import { BotSettingsView } from './bot-settings-view';

// 없는 봇(404)은 페이지 에러, 그 밖의 실패는 다시 시도 (Figma Bot Settings / 에러)
export function BotSettingsBoundary({ botId }: { botId: string }) {
  return (
    <QueryBoundary
      loading={<BotSettingsSkeleton />}
      errorTitle="봇 설정을 불러오지 못했어요"
      errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요."
      isErrorInCard
      notFoundFallback={<BotNotFound />}
    >
      <BotSettingsView botId={botId} />
    </QueryBoundary>
  );
}
