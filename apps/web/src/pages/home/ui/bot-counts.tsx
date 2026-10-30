'use client';

import { Skeleton, Text } from '@xonic0506/sonic-ui';
import type { ReactNode } from 'react';

import { useHomeSummaryQuery } from '@/entities/home';

function BotCountGrid({ children }: { children: ReactNode }) {
  return <dl className="m-0 grid grid-cols-2 gap-4">{children}</dl>;
}

function BotCount({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Text as="div" variant="caption" tone="muted">
        <dt>{label}</dt>
      </Text>
      <Text as="div" variant="mono">
        <dd className="m-0">{value}</dd>
      </Text>
    </div>
  );
}

const LABELS = ['실행 중', '일시정지', '자금 대기', '정지'] as const;

// 긴급 정지 카드의 상태별 봇 수
export function BotCounts() {
  const { data: home } = useHomeSummaryQuery();
  const { running, paused, waitingFunds, stopped } = home.botCounts;
  const values = [running, paused, waitingFunds, stopped];
  return (
    <BotCountGrid>
      {LABELS.map((label, index) => (
        <BotCount key={label} label={label} value={values[index] ?? 0} />
      ))}
    </BotCountGrid>
  );
}

export function BotCountsSkeleton() {
  return (
    <div aria-busy>
      <BotCountGrid>
        {LABELS.map((label) => (
          <BotCount
            key={label}
            label={label}
            value={<Skeleton shape="text" className="w-6" />}
          />
        ))}
      </BotCountGrid>
    </div>
  );
}
