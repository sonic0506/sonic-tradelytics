import { Card, Text } from '@xonic0506/sonic-ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type KpiCardProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: ReactNode;
};

// Figma Home / KpiCard: 아이콘 칸 40, 라벨 caption, 값 title, 보조 mono-caption.
// 좁은 화면은 두 칸이라 아이콘을 빼고 글자만 둬요(Figma Mobile).
export function KpiCard({ icon: Icon, label, value, detail }: KpiCardProps) {
  return (
    <Card className="h-full flex-row items-start gap-3 whitespace-nowrap">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-subtle text-muted max-sm:hidden">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        {value}
        {detail}
      </div>
    </Card>
  );
}
