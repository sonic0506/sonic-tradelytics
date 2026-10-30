import { Text } from '@xonic0506/sonic-ui';
import { Suspense } from 'react';

import { AccuracyContent } from './accuracy-content';
import { AccuracyReportSkeleton } from './accuracy-report';

// 정확도 분석 (F3, Figma Accuracy)
export function AccuracyPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Text as="h1" variant="display">
          정확도 분석
        </Text>
        <Text as="p" tone="muted">
          봇이 남긴 예측이 실제로 맞았는지 모아서 봐요. 청산한 거래만 채점해요.
        </Text>
      </header>
      <Suspense fallback={<AccuracyReportSkeleton />}>
        <AccuracyContent />
      </Suspense>
    </div>
  );
}
