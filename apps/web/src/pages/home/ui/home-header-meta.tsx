'use client';

import { Badge, Skeleton, Text } from '@xonic0506/sonic-ui';

import {
  getMarketSession,
  MARKET_SESSION_LABEL,
  useEngineStatusQuery,
} from '@/entities/engine-status';
import { useHomeSummaryQuery } from '@/entities/home';
import { formatTime } from '@/shared/lib';

// 제목 오른쪽: 장 상태와 계좌 동기화 시각
export function HomeHeaderMeta() {
  const { data: home } = useHomeSummaryQuery();
  const { data: engine } = useEngineStatusQuery();
  const { syncedAt } = home.account;
  const session = getMarketSession(engine, syncedAt);
  return (
    <div className="flex items-center gap-2">
      <Badge tone={session === 'regular' ? 'success' : 'neutral'}>
        {MARKET_SESSION_LABEL[session]}
      </Badge>
      <Text variant="mono-caption" tone="muted">
        {formatTime(syncedAt)} 기준
      </Text>
    </div>
  );
}

export function HomeHeaderMetaSkeleton() {
  return (
    <div aria-busy className="flex items-center gap-2">
      <Skeleton shape="text" className="w-12" />
      <Skeleton shape="text" className="w-20" />
    </div>
  );
}
