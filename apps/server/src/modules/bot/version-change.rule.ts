import { DAY_TRADING_FIELDS, type HoldingAction } from './bot.constants.js';

// 규칙 값 버전 한 개의 값 (bot_versions에서 판단·위험에 쓰는 값)
export interface VersionValues {
  params: Record<string, unknown>;
  orderSizeValue: number;
  splitCount: number;
  maxPositions: number;
  dailyLossPct: number;
  totalLossPct: number;
  stopStreak: number;
  onDailyLimit: HoldingAction;
}

export interface RuleChange {
  label: string;
  from: string;
  to: string;
}

export interface VersionChange {
  // 바뀐 값이 없으면 null
  changeKind: 'decision_change' | 'risk_only' | null;
  changes: RuleChange[];
}

// 줄이면 위험만 줄어드는 값. 이 값들이 줄기만 했으면 risk_only예요 (FR-BOT-11, POL-RISK-13)
const RISK_FIELDS = [
  { key: 'dailyLossPct', label: '하루 손실 한도', unit: '%' },
  { key: 'totalLossPct', label: '누적 손실 한도', unit: '%' },
  { key: 'stopStreak', label: '연속 손절 횟수', unit: '회' },
  { key: 'orderSizeValue', label: '1회 주문 금액', unit: '원' },
] as const;

const OTHER_FIELDS = [
  { key: 'splitCount', label: '분할 매수 횟수', unit: '회' },
  { key: 'maxPositions', label: '최대 보유 종목 수', unit: '개' },
  { key: 'onDailyLimit', label: '하루 한도 도달 시', unit: '' },
] as const;

// "HH:mm:ss" → "HH:mm"
const HH_MM = 5;

function show(value: unknown, unit: string): string {
  if (typeof value === 'number')
    return `${value.toLocaleString('ko-KR')}${unit}`;
  if (typeof value === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(value))
    return value.slice(0, HH_MM);
  return String(value);
}

// 지금 버전과 새 값을 비교해 변경 종류와 바뀐 값을 줘요. 위험을 줄이는 값만 줄었으면 risk_only, 그 밖에 하나라도 바뀌면 decision_change예요
export function versionChange(
  current: VersionValues,
  next: VersionValues,
): VersionChange {
  const changes: RuleChange[] = [];
  let isDecision = false;
  for (const { key, label, unit } of DAY_TRADING_FIELDS) {
    const from = current.params[key];
    const to = next.params[key];
    if (from === to) continue;
    isDecision = true;
    changes.push({
      label,
      from: show(from, unit ?? ''),
      to: show(to, unit ?? ''),
    });
  }
  for (const { key, label, unit } of RISK_FIELDS) {
    const from = current[key];
    const to = next[key];
    if (from === to) continue;
    if (to > from) isDecision = true;
    changes.push({ label, from: show(from, unit), to: show(to, unit) });
  }
  for (const { key, label, unit } of OTHER_FIELDS) {
    const from = current[key];
    const to = next[key];
    if (from === to) continue;
    isDecision = true;
    changes.push({ label, from: show(from, unit), to: show(to, unit) });
  }
  return {
    changeKind:
      changes.length === 0
        ? null
        : isDecision
          ? 'decision_change'
          : 'risk_only',
    changes,
  };
}
