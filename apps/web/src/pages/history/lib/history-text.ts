import type { PositionOrder, PositionStatus } from '@/entities/position';
import { formatHourMinute } from '@/shared/lib';

export const STATUS_BADGE: Record<
  PositionStatus,
  { label: string; tone: 'neutral' | 'success' | 'warning' }
> = {
  holding: { label: '보유 중', tone: 'success' },
  pending: { label: '미체결', tone: 'warning' },
  closed: { label: '청산 완료', tone: 'neutral' },
  canceled: { label: '취소', tone: 'neutral' },
};

export const ORIGIN_LABEL: Record<PositionOrder['origin'], string> = {
  bot: '봇',
  protective: '보호 주문',
  manual: '직접',
};

// 주문 구분: 매수 · 매도 · 손절 조건
export function getOrderKindText(order: PositionOrder) {
  if (order.kind === 'stop_condition') return '손절 조건';
  return order.side === 'BUY' ? '매수' : '매도';
}

export function getOrderStatusText(order: PositionOrder) {
  switch (order.status) {
    case 'filled':
      return '체결';
    case 'partial':
      return '일부 체결';
    case 'pending':
      return '체결 대기';
    case 'canceled':
      return order.statusAt
        ? `취소 (${formatHourMinute(order.statusAt)})`
        : '취소';
  }
}
