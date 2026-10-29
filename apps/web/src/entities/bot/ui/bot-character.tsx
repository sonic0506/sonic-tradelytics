import Image from 'next/image';

import type { BotType } from '@/shared/api';

// public/bots의 파일 이름은 Figma Bot / Character 설명을 따라요.
const IMAGE_NAME: Record<BotType, string> = {
  day: 'day_trading',
  closing: 'closing_bet',
  swing: 'swing',
  scalping: 'scalping',
};

type BotCharacterProps = {
  type: BotType;
  className?: string;
};

// 봇 유형별 캐릭터 64×64. 장식이라 alt를 비워요.
export function BotCharacter({ type, className = '' }: BotCharacterProps) {
  return (
    <span
      className={`relative block size-16 shrink-0 overflow-hidden rounded-lg bg-subtle ${className}`}
    >
      <Image
        src={`/bots/${IMAGE_NAME[type]}.webp`}
        alt=""
        fill
        sizes="64px"
        className="object-contain"
      />
    </span>
  );
}
