'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

import { isCurrentPath, NAV_ITEMS } from '../model/nav-items';

type NavLinksProps = {
  // 지금 주소. 모르면(미리 그릴 때) 빈 문자열이라 선택 표시 없이 그려요
  pathname: string;
  // 모바일 서랍에서 항목을 누르면 서랍을 닫아요
  onNavigate?: () => void;
};

function NavLinks({ pathname, onNavigate }: NavLinksProps) {
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
                // Figma App / NavItem: 선택 bg/selected + text/default + body-strong, 나머지 text/muted + body
                className={`flex h-10 items-center gap-3 rounded-md px-3 transition-colors duration-(--sn-duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${isCurrent ? 'bg-selected text-body-strong text-default' : 'text-body text-muted hover:bg-subtle hover:text-default'}`}
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

function CurrentNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? '';
  return (
    <NavLinks pathname={pathname} {...(onNavigate ? { onNavigate } : {})} />
  );
}

// 동적 경로(/bots/[id])에서는 주소가 요청 때 정해져서, 미리 그릴 때는 선택 표시 없는 메뉴를 먼저 보여 줘요.
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = onNavigate ? { onNavigate } : {};
  return (
    <Suspense fallback={<NavLinks pathname="" {...navigate} />}>
      <CurrentNavLinks {...navigate} />
    </Suspense>
  );
}
