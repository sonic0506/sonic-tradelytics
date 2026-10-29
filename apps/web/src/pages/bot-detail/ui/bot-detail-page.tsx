import { ChevronLeft } from 'lucide-react';
import NextLink from 'next/link';
import { Suspense } from 'react';

import { BotDetailContent } from './bot-detail-content';
import { BotDetailSkeleton } from './bot-detail-skeleton';

export function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-col gap-6">
      <NextLink
        href="/bots"
        className="flex w-fit items-center gap-1 text-label text-default hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ChevronLeft className="size-4" aria-hidden />봇 목록
      </NextLink>
      <Suspense fallback={<BotDetailSkeleton />}>
        <BotDetailContent params={params} />
      </Suspense>
    </div>
  );
}
