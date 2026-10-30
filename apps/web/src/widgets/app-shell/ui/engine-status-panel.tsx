'use client';

import { Skeleton, Text } from '@xonic0506/sonic-ui';

import { useEngineStatusQuery } from '@/entities/engine-status';
import { formatTime } from '@/shared/lib';

import {
  ENGINE_HEALTH_LABEL,
  ENGINE_HEALTH_TONE,
  getHaltReasonLabel,
} from '../model/engine-labels';

const DOT_CLASS = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
} as const;

// 사이드 내비 아래 엔진 상태 (GET /v1/engine-status, 10초)
export function EngineStatusPanel() {
  const { data: status } = useEngineStatusQuery();
  const time = formatTime(status.heartbeatAt);
  const detail =
    status.health === 'halted'
      ? `${time} · ${getHaltReasonLabel(status.haltReasons)}`
      : status.health === 'unresponsive'
        ? `${time} 마지막 응답`
        : `${time} 응답`;
  return (
    <div className="flex items-center gap-2 rounded-md bg-subtle p-3">
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${DOT_CLASS[ENGINE_HEALTH_TONE[status.health]]}`}
      />
      <div className="flex flex-col">
        <Text variant="caption">{ENGINE_HEALTH_LABEL[status.health]}</Text>
        <Text variant="mono-caption" tone="muted">
          {detail}
        </Text>
      </div>
    </div>
  );
}

export function EngineStatusPanelSkeleton() {
  return (
    <div aria-busy className="flex items-center gap-2 rounded-md bg-subtle p-3">
      <Skeleton shape="text" className="w-24" />
    </div>
  );
}
