'use client';

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Card, ErrorState } from '@xonic0506/sonic-ui';
import { TriangleAlert } from 'lucide-react';
import { type ReactNode, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { HttpError } from '@/shared/api';

type QueryBoundaryProps = {
  children: ReactNode;
  // 처음 불러오는 동안 같은 자리에 보여 줄 Skeleton
  loading: ReactNode;
  // 실패 문구. 다시 시도 버튼은 자동으로 붙어요
  errorTitle: string;
  errorDescription?: string;
  // 카드 안처럼 좁은 곳이면 그림 대신 아이콘을 써요(DESIGN.md §10 EmptyState / ErrorState)
  isCompact?: boolean;
  // 실패 문구를 Card로 감싸요. 정상일 때 카드가 없는 자리(요약 수치)에 써요
  isErrorInCard?: boolean;
  // 실패 문구 대신 그릴 것. 다시 시도 없이 다른 모양으로 대신할 때 써요(null이면 비워요)
  errorFallback?: ReactNode;
  // 404면 다시 시도 대신 그릴 것(없는 봇 같은 페이지 에러)
  notFoundFallback?: ReactNode;
};

// 데이터를 쓰는 블록 바로 바깥에 두는 Suspense + ErrorBoundary 묶음이에요(하네스 3절).
export function QueryBoundary({
  children,
  loading,
  errorTitle,
  errorDescription,
  isCompact = false,
  isErrorInCard = false,
  errorFallback,
  notFoundFallback,
}: QueryBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => {
            if (
              notFoundFallback !== undefined &&
              error instanceof HttpError &&
              error.status === 404
            ) {
              return notFoundFallback;
            }
            if (errorFallback !== undefined) return errorFallback;
            const errorState = (
              <ErrorState
                title={errorTitle}
                {...(errorDescription ? { description: errorDescription } : {})}
                {...(isCompact ? { icon: <TriangleAlert /> } : {})}
                onRetry={resetErrorBoundary}
              />
            );
            return isErrorInCard ? <Card>{errorState}</Card> : errorState;
          }}
        >
          <Suspense fallback={loading}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
