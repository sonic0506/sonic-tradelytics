import { buttonVariants, Text } from '@xonic0506/sonic-ui';
import { Plus } from 'lucide-react';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

type BotListViewProps = {
  summary: ReactNode;
  content: ReactNode;
};

// 제목 · 봇 만들기 · 필터와 목록 배치 (Figma Bot List)
export function BotListView({ summary, content }: BotListViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
        <div className="flex flex-col gap-1">
          <Text as="h1" variant="display">
            봇
          </Text>
          {summary}
        </div>
        <NextLink
          href="/bots/new"
          className={`${buttonVariants()} max-sm:w-full`}
        >
          <Plus />봇 만들기
        </NextLink>
      </header>
      {content}
    </div>
  );
}
