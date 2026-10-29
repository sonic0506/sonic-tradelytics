'use client';

import { useEngineStatusQuery } from '@/entities/engine-status';
import { KillSwitchButton } from '@/features/engine/kill-switch';

// 엔진이 이미 전체 정지면 버튼을 막아요.
export function KillSwitchAction() {
  const { data: engine } = useEngineStatusQuery();
  return <KillSwitchButton isHalted={engine.health === 'halted'} />;
}
