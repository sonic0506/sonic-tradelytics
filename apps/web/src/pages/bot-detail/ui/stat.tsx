import { Text } from '@xonic0506/sonic-ui';
import type { ReactNode } from 'react';

// 라벨 caption + text/muted, 값 mono (Figma Home / Stat). dl 안에서 써요.
export function Stat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Text as="div" variant="caption" tone="muted">
        <dt>{label}</dt>
      </Text>
      <dd className="m-0 font-mono text-body text-default">{children}</dd>
    </div>
  );
}
