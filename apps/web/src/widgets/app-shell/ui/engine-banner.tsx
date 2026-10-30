'use client';

import { TriangleAlert } from 'lucide-react';

import { useEngineStatusQuery } from '@/entities/engine-status';
import { formatTime } from '@/shared/lib';

import { getHaltReasonLabel } from '../model/engine-labels';

const TONE_CLASS = {
  danger: 'border-danger bg-danger-subtle text-danger',
  warning: 'border-warning bg-warning-subtle text-warning',
} as const;

// 모든 화면 위 엔진 이상 띠. 정상이면 그리지 않아요(Figma Home / EngineBanner).
export function EngineBanner() {
  const { data: status } = useEngineStatusQuery();
  if (status.health === 'running') return null;

  const isHalted = status.health === 'halted';
  const { title, description } = isHalted
    ? {
        title: '엔진이 전체 정지 상태예요',
        description: `${getHaltReasonLabel(status.haltReasons)}로 멈췄어요. 봇마다 다시 시작해야 신규 주문이 나가요.`,
      }
    : status.health === 'unresponsive'
      ? {
          title: '엔진 응답이 없어요',
          description: `마지막 응답은 ${formatTime(status.heartbeatAt)}이에요. 화면의 숫자가 최신이 아닐 수 있어요.`,
        }
      : {
          title: '시세가 끊긴 종목이 있어요',
          description: `${status.staleSymbols.join(', ')} 시세가 들어오지 않아 이 종목은 새로 사지 않아요.`,
        };

  return (
    <div
      role={isHalted ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 ${TONE_CLASS[isHalted ? 'danger' : 'warning']}`}
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-body-strong">{title}</p>
        <p className="text-caption">{description}</p>
      </div>
    </div>
  );
}
