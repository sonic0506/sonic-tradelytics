import { Text } from '@xonic0506/sonic-ui';
import { Suspense } from 'react';

import { OpsContent, OpsContentSkeleton } from './ops-content';

// 운영 (Figma Ops)
export function OpsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Text as="h1" variant="display">
          운영
        </Text>
        <Text as="p" tone="muted">
          한도 도달, 일시정지, 장애처럼 봇을 멈추거나 경고한 기록이에요.
          텔레그램 알림을 보냈는지도 함께 봐요.
        </Text>
      </header>
      <Suspense fallback={<OpsContentSkeleton />}>
        <OpsContent />
      </Suspense>
    </div>
  );
}
