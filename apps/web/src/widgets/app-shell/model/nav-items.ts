import {
  Bot,
  ChartColumn,
  House,
  type LucideIcon,
  ReceiptText,
  ScrollText,
  ShieldAlert,
} from 'lucide-react';

type NavItem = { href: string; label: string; icon: LucideIcon };

// Figma App / SideNav 순서예요. 아직 없는 화면은 404로 가요(M4에서 차례로 만들어요).
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '홈', icon: House },
  { href: '/bots', label: '봇', icon: Bot },
  { href: '/history', label: '투자 내역', icon: ReceiptText },
  { href: '/compare', label: '봇 비교', icon: ChartColumn },
  { href: '/accuracy', label: '근거', icon: ScrollText },
  { href: '/ops', label: '운영', icon: ShieldAlert },
];

export function isCurrentPath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
