'use client';

import {
  Button,
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
  Text,
} from '@xonic0506/sonic-ui';
import { Menu } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { NavList } from './nav-list';

// 좁은 화면(640 미만) 머리. 메뉴를 누르면 사이드 내비 항목을 Dialog로 열어요.
export function TopBar({ engineStatus }: { engineStatus: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-default bg-surface px-2 py-3 sm:hidden">
      <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DialogTrigger
          render={
            <Button size="icon-md" variant="ghost" aria-label="메뉴 열기" />
          }
        >
          <Menu />
        </DialogTrigger>
        <DialogPopup>
          <DialogTitle>메뉴</DialogTitle>
          <NavList onNavigate={() => setIsMenuOpen(false)} />
        </DialogPopup>
      </Dialog>
      <Text variant="body-strong" className="flex-1">
        Sonic Tradelytics
      </Text>
      {engineStatus}
    </header>
  );
}
