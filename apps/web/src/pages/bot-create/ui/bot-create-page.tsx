import { Text } from '@xonic0506/sonic-ui';
import { ChevronLeft } from 'lucide-react';
import NextLink from 'next/link';

import { BotCreateForm } from './bot-create-form';

// 봇 만들기 (F1). 서버에서 미리 받을 데이터가 없어서 폼만 그려요.
export function BotCreatePage() {
  return (
    <div className="flex flex-col gap-6">
      <NextLink
        href="/bots"
        className="flex w-fit items-center gap-1 text-label text-default hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ChevronLeft className="size-4" aria-hidden />봇 목록
      </NextLink>
      <header className="flex flex-col gap-1">
        <Text as="h1" variant="display">
          봇 만들기
        </Text>
        <Text as="p" tone="muted">
          4단계로 만들어요. 새 봇은 검증 구간에서 투자금을 10만 원까지만 써요.
        </Text>
      </header>
      <BotCreateForm />
    </div>
  );
}
