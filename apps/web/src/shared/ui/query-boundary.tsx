'use client';

import { QueryErrorResetBoundary, useQueryClient } from '@tanstack/react-query';
import { Card, ErrorState } from '@xonic0506/sonic-ui';
import { TriangleAlert } from 'lucide-react';
import { type ReactNode, Suspense, useEffect } from 'react';
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

// 같은 쿼리를 쓰는 다른 블록에서 다시 시도해 성공하면 이 블록도 다시 그려요.
// 실패 문구를 숨긴 블록(errorFallback={null})과 같은 요청에서 나온 카드가 함께 돌아와요.
function RecoverOnSuccess({
  failedQueryHashes,
  onRecover,
  children,
}: {
  failedQueryHashes: string[];
  onRecover: () => void;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const hashKey = failedQueryHashes.join('\n');
  useEffect(() => {
    if (!hashKey) return;
    const failed = new Set(hashKey.split('\n'));
    return queryClient.getQueryCache().subscribe((event) => {
      if (
        failed.has(event.query.queryHash) &&
        event.query.state.status === 'success'
      ) {
        onRecover();
      }
    });
  }, [queryClient, hashKey, onRecover]);
  return children;
}

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
  const queryClient = useQueryClient();
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
            const recover = (fallback: ReactNode) => (
              <RecoverOnSuccess
                failedQueryHashes={queryClient
                  .getQueryCache()
                  .findAll({
                    predicate: (query) => query.state.error === error,
                  })
                  .map((query) => query.queryHash)}
                onRecover={resetErrorBoundary}
              >
                {fallback}
              </RecoverOnSuccess>
            );
            if (errorFallback !== undefined) return recover(errorFallback);
            const errorState = (
              <ErrorState
                title={errorTitle}
                {...(errorDescription ? { description: errorDescription } : {})}
                {...(isCompact ? { icon: <TriangleAlert /> } : {})}
                onRetry={resetErrorBoundary}
              />
            );
            return recover(
              isErrorInCard ? <Card>{errorState}</Card> : errorState,
            );
          }}
        >
          <Suspense fallback={loading}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
