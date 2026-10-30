import {
  BOT_TYPE_LABEL,
  type BotDetailView,
  type ReleaseCriterion,
  RISK_PROFILE_LABEL,
} from '@/entities/bot';
import {
  formatMonthDay,
  formatMonthDayTime,
  formatNegativePercent,
  toTradeDate,
} from '@/shared/lib';

// "쉬는 중 · 오늘 15:10 운영" → "쉬는 중(오늘 15:10 운영)"
export function toParenthesized(text: string) {
  const [head, ...rest] = text.split(' · ');
  return rest.length === 0 ? text : `${head}(${rest.join(' · ')})`;
}

// 제목 아래 한 줄 (Figma Bot Detail 머리)
export function getDetailMetaLine(bot: BotDetailView) {
  const parts = [
    BOT_TYPE_LABEL[bot.type],
    RISK_PROFILE_LABEL[bot.riskProfile],
    `v${bot.version}`,
  ];
  if (bot.status === 'waiting_funds' && bot.waitingSince) {
    parts.push(`${formatMonthDayTime(bot.waitingSince)}부터 자금 대기`);
    return parts.join(' · ');
  }
  if (bot.startedAt) parts.push(`${toTradeDate(new Date(bot.startedAt))} 시작`);
  if (bot.stage === 'released' && bot.releasedAt) {
    parts.push(
      `${formatMonthDay(toTradeDate(new Date(bot.releasedAt)))} 상한 해제`,
    );
  }
  if (bot.statusDetail) parts.push(toParenthesized(bot.statusDetail));
  return parts.join(' · ');
}

export const CRITERION_LABEL: Record<ReleaseCriterion['key'], string> = {
  period: '검증 기간',
  closed_trades: '청산 거래 수',
  net_pnl: '순손익',
  profit_factor: '손익비',
  mdd: 'MDD',
};

// 기준 문구 (POL-RISK-13)
export function getCriterionRule({ key, threshold }: ReleaseCriterion) {
  switch (key) {
    case 'period':
      return `${threshold}거래일 이상`;
    case 'closed_trades':
      return `${threshold}건 이상`;
    case 'net_pnl':
      return `${threshold}원 초과`;
    case 'profit_factor':
      return `${threshold} 이상`;
    case 'mdd':
      return `누적 손실 한도의 절반(${threshold}%) 이하`;
  }
}

// 손익이 아닌 기준 값. 순손익은 화면에서 손익 색으로 그려요.
export function formatCriterionValue({ key, value }: ReleaseCriterion) {
  if (value === null) return '−';
  switch (key) {
    case 'period':
      return `${value}거래일`;
    case 'closed_trades':
      return `${value}건`;
    case 'net_pnl':
      return String(value);
    case 'profit_factor':
      return value.toFixed(2);
    case 'mdd':
      return value === 0 ? '0%' : formatNegativePercent(value);
  }
}
