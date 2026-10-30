import Image from 'next/image';

import type { BotType } from '@/shared/api';

// public/bots의 파일 이름은 Figma Bot / Character 설명을 따라요.
const IMAGE_NAME: Record<BotType, string> = {
  day: 'day_trading',
  closing: 'closing_bet',
  swing: 'swing',
  scalping: 'scalping',
};

// lg 64(봇 카드), md 40(목록 한 줄)
const SIZE = {
  md: { className: 'size-10', pixels: '40px' },
  lg: { className: 'size-16', pixels: '64px' },
} as const;

type BotCharacterProps = {
  type: BotType;
  size?: keyof typeof SIZE;
};

// 봇 유형별 캐릭터. 장식이라 alt를 비워요.
export function BotCharacter({ type, size = 'lg' }: BotCharacterProps) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-lg bg-subtle ${SIZE[size].className}`}
    >
      <Image
        src={`/bots/${IMAGE_NAME[type]}.webp`}
        alt=""
        fill
        sizes={SIZE[size].pixels}
        className="object-contain"
      />
    </span>
  );
}
