'use client';

import { EmptyState, Skeleton, Text } from '@xonic0506/sonic-ui';
import { CircleAlert, Inbox } from 'lucide-react';

import {
  RISK_EVENT_KIND_LABEL,
  RISK_EVENT_KIND_TONE,
  useTodayRiskEventsQuery,
} from '@/entities/risk-event';
import { formatHourMinute } from '@/shared/lib';

const ICON_CLASS = { danger: 'text-danger', warning: 'text-warning' } as const;

export function TodayRiskEventList() {
  const { data } = useTodayRiskEventsQuery();
  if (data.items.length === 0) {
    return <EmptyState icon={<Inbox />} title="리스크 이벤트가 없어요" />;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {data.items.map((event) => (
        <li key={event.id} className="flex items-start gap-2">
          <CircleAlert
            aria-hidden
            className={`size-4 shrink-0 ${ICON_CLASS[RISK_EVENT_KIND_TONE[event.kind]]}`}
          />
          <div className="flex flex-col gap-1">
            <Text as="p">{event.message}</Text>
            <Text variant="mono-caption" tone="muted">
              {formatHourMinute(event.occurredAt)} ·{' '}
              {RISK_EVENT_KIND_LABEL[event.kind]}
            </Text>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TodayRiskEventListSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      {[1, 2, 3].map((row) => (
        <div key={row} className="flex flex-col gap-2">
          <Skeleton shape="text" className="w-60" />
          <Skeleton shape="text" className="w-24" />
        </div>
      ))}
    </div>
  );
}
