import {
  formatHourMinute,
  formatManWon,
  formatRatio,
  formatWon,
  toTradeDate,
} from '@/shared/lib';

import type { BotListItem, StatusReason } from '../model/bot.schema';

const DAY_MS = 86_400_000;
const runDayFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

// 다음 운영일: "오늘", "내일", "11/2(월)"
export function formatRunDay(iso: string, now: number) {
  const target = toTradeDate(new Date(iso));
  if (target === toTradeDate(new Date(now))) return '오늘';
  if (target === toTradeDate(new Date(now + DAY_MS))) return '내일';
  const parts = runDayFormat.formatToParts(new Date(iso));
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('month')}/${part('day')}(${part('weekday')})`;
}

export function formatStatusReason({ code, count, amount }: StatusReason) {
  switch (code) {
    case 'consecutive_losses':
      return `연속 손절 ${count ?? 0}회로 멈췄어요`;
    case 'daily_loss_limit':
      return '하루 손실 한도에 닿았어요';
    case 'cumulative_loss_limit':
      return '누적 손실 한도에 닿았어요';
    case 'insufficient_funds':
      return `${formatWon(amount ?? 0)}이 모자라요`;
    case 'manual':
      return '직접 멈췄어요';
    case 'kill_switch':
      return '긴급 정지로 멈췄어요';
    case 'period_ended':
      return '운용 기간이 끝났어요';
  }
}

// 오늘 운영 상황 문구 (Bots 페이지 메모 FR-BOT-12 규칙)
function formatActivity(bot: BotListItem, now: number) {
  if (!bot.activity) return null;
  if (bot.activity === 'trading')
    return `운영 중 · ${bot.tradingHours.end}까지`;
  const label =
    bot.activity === 'limit_reached'
      ? '하루 한도 도달'
      : bot.activity === 'market_closed'
        ? '휴장'
        : bot.resting
          ? '쉬는 중'
          : '운영 시간 밖';
  if (!bot.nextRunAt) return label;
  return `${label} · ${formatRunDay(bot.nextRunAt, now)} ${formatHourMinute(bot.nextRunAt)} 운영`;
}

// 상태 배지 아래 한 줄: 실행 중이면 오늘 운영 상황, 아니면 멈춘·기다리는 이유
export function getStatusDetail(bot: BotListItem, now: number) {
  if (bot.status === 'running') return formatActivity(bot, now);
  return bot.statusReason ? formatStatusReason(bot.statusReason) : null;
}

function isStarted(bot: BotListItem) {
  return bot.status !== 'ready' && bot.status !== 'waiting_funds';
}

// 단계 아래 한 줄
export function getStageDetail(bot: BotListItem) {
  if (bot.status === 'stopped' && bot.endedAt) {
    return `${toTradeDate(new Date(bot.endedAt))} 종료`;
  }
  if (bot.stage === 'released') {
    return bot.releasedAt
      ? `${toTradeDate(new Date(bot.releasedAt))} 해제`
      : '';
  }
  const cap = `상한 ${formatManWon(bot.capAmount)}`;
  if (!isStarted(bot) || !bot.releaseProgress) return `시작 전 · ${cap}`;
  const { passed, total } = bot.releaseProgress;
  return `기준 ${passed}/${total} 통과 · ${cap}`;
}

// 좁은 화면 카드의 단계: "상한 해제", "검증 중 3/5", "검증 중"
export function getStageShort(bot: BotListItem) {
  if (bot.stage === 'released') return '상한 해제';
  if (isStarted(bot) && bot.releaseProgress && bot.status !== 'stopped') {
    return `검증 중 ${bot.releaseProgress.passed}/${bot.releaseProgress.total}`;
  }
  return '검증 중';
}

// 투자금 아래 한 줄
export function getBudgetDetail(bot: BotListItem) {
  if (bot.status === 'stopped') return '운용 자산으로 반환';
  const { type, value } = bot.budgetSetting;
  const setting =
    type === 'fixed' ? formatWon(value) : `정률 ${formatRatio(value)}`;
  if (bot.stage === 'verifying') return `설정 ${setting}`;
  return type === 'ratio' ? setting : '정액';
}
