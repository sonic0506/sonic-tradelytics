import { Text } from '@xonic0506/sonic-ui';
import { Suspense } from 'react';

import { CompareContent, CompareContentSkeleton } from './compare-content';

// 봇 비교 (F2, Figma Compare)
export function BotComparePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Text as="h1" variant="display">
          봇 비교
        </Text>
        <Text as="p" tone="muted">
          같은 기간, 같은 기준으로 봇 성과를 비교해요. 손익은 수수료·세금을 뺀
          금액이에요.
        </Text>
      </header>
      <Suspense fallback={<CompareContentSkeleton />}>
        <CompareContent />
      </Suspense>
    </div>
  );
}
