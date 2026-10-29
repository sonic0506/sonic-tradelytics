import { Text } from '@xonic0506/sonic-ui';
import NextLink from 'next/link';

import {
  BOT_TYPE_LABEL,
  BotCharacter,
  type BotListRow,
  RISK_PROFILE_LABEL,
} from '@/entities/bot';

// 캐릭터 + 이름(상세로 가는 링크) + 유형·성향·버전
export function BotName({ bot }: { bot: BotListRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BotCharacter type={bot.type} size="md" />
      <div className="flex min-w-0 flex-col">
        <NextLink
          href={`/bots/${bot.id}`}
          className="truncate text-body-strong text-default hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {bot.name}
        </NextLink>
        <Text variant="caption" tone="muted" className="truncate">
          {BOT_TYPE_LABEL[bot.type]} · {RISK_PROFILE_LABEL[bot.riskProfile]} · v
          {bot.version}
        </Text>
      </div>
    </div>
  );
}
