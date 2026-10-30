import { ChevronLeft } from 'lucide-react';
import NextLink from 'next/link';

// 제목 위 "‹ 이전 화면" 링크
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <NextLink
      href={href}
      className="flex w-fit items-center gap-1 text-label text-default hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </NextLink>
  );
}
