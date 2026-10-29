'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

import { isCurrentPath, NAV_ITEMS } from '../model/nav-items';

type NavListProps = {
  // 모바일 서랍에서 항목을 누르면 서랍을 닫아요
  onNavigate?: () => void;
};

export function NavList({ onNavigate }: NavListProps) {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="주 메뉴">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isCurrent = isCurrentPath(pathname, href);
          return (
            <li key={href}>
              <NextLink
                href={href}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                {...(isCurrent ? { 'aria-current': 'page' as const } : {})}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-body text-default transition-colors duration-(--sn-duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${isCurrent ? 'bg-selected' : 'hover:bg-subtle'}`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NextLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
