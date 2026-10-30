'use client';

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Card, ErrorState } from '@xonic0506/sonic-ui';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { BotNotFound } from '@/entities/bot';
import { HttpError } from '@/shared/api';

import { BotDetailSkeleton } from './bot-detail-skeleton';
import { BotDetailView } from './bot-detail-view';

// 없는 봇(404)은 페이지 에러, 그 밖의 실패는 다시 시도를 보여 줘요(Figma Bot Detail / 404 · 에러).
export function BotDetailBoundary({ botId }: { botId: string }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) =>
            error instanceof HttpError && error.status === 404 ? (
              <BotNotFound />
            ) : (
              <Card>
                <ErrorState
                  title="봇 정보를 불러오지 못했어요"
                  description="네트워크 연결을 확인하고 다시 시도해 주세요."
                  onRetry={resetErrorBoundary}
                />
              </Card>
            )
          }
        >
          <Suspense fallback={<BotDetailSkeleton />}>
            <BotDetailView botId={botId} />
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
