import { ChevronLeft } from 'lucide-react';
import NextLink from 'next/link';
import { Suspense } from 'react';

import { PositionRationaleContent } from './position-rationale-content';
import { PositionRationaleSkeleton } from './position-rationale-skeleton';

export function PositionRationalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <NextLink
        href="/history"
        className="flex w-fit items-center gap-1 text-label text-default hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ChevronLeft className="size-4" aria-hidden />
        투자 내역
      </NextLink>
      <Suspense fallback={<PositionRationaleSkeleton />}>
        <PositionRationaleContent params={params} />
      </Suspense>
    </div>
  );
}
