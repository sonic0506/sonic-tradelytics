import { Text } from '@xonic0506/sonic-ui';
import { Suspense } from 'react';

import { HistoryContent } from './history-content';
import { HistoryListSkeleton } from './history-list';
import { HistorySummarySkeleton } from './history-summary';

// 투자 내역 (F2, Figma History)
export function HistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Text as="h1" variant="display">
          투자 내역
        </Text>
        <Text as="p" tone="muted">
          거래 한 줄은 진입부터 청산까지 포지션 하나예요. 손익은 수수료·세금을
          뺀 금액이에요.
        </Text>
      </header>
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <HistorySummarySkeleton />
            <HistoryListSkeleton />
          </div>
        }
      >
        <HistoryContent />
      </Suspense>
    </div>
  );
}
