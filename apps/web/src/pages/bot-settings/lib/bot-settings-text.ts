import {
  BOT_STAGE_LABEL,
  BOT_STATUS_LABEL,
  type BotDetailView,
  formatHoldings,
} from '@/entities/bot';

// "쉬는 중 · 오늘 15:10 운영" → "쉬는 중(오늘 15:10 운영)"
function toParenthesized(text: string) {
  const [head, ...rest] = text.split(' · ');
  return rest.length === 0 ? text : `${head}(${rest.join(' · ')})`;
}

// 제목 아래 한 줄 (Figma Bot Settings 머리)
export function getSettingsMetaLine(bot: BotDetailView) {
  const parts = [bot.name, BOT_STATUS_LABEL[bot.status]];
  if (bot.notRestingReasons.includes('holding') && bot.holdings.length > 0) {
    parts.push(`보유 중(${formatHoldings(bot.holdings)})`);
  } else if (bot.statusDetail) {
    parts.push(toParenthesized(bot.statusDetail));
  }
  parts.push(BOT_STAGE_LABEL[bot.stage]);
  const pending = bot.pendingVersion
    ? ` (v${bot.pendingVersion} 적용 대기)`
    : '';
  parts.push(`규칙 값 v${bot.ruleVersion.version}${pending}`);
  return parts.join(' · ');
}
