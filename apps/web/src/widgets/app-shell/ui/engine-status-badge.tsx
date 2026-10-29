'use client';

import { Badge } from '@xonic0506/sonic-ui';

import { useEngineStatusQuery } from '@/entities/engine-status';

import {
  ENGINE_HEALTH_LABEL,
  ENGINE_HEALTH_TONE,
} from '../model/engine-labels';

// 좁은 화면 TopBar 오른쪽 엔진 상태
export function EngineStatusBadge() {
  const { data: status } = useEngineStatusQuery();
  return (
    <Badge tone={ENGINE_HEALTH_TONE[status.health]}>
      {ENGINE_HEALTH_LABEL[status.health]}
    </Badge>
  );
}
