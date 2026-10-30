import { Text, type TextVariant } from '@xonic0506/sonic-ui';
import type { ReactNode } from 'react';

import { getPnlDirection, PNL_TEXT_CLASS } from '@/shared/lib';

type PnlTextProps = {
  // 색을 정할 손익 값. 부호는 children 문구가 이미 갖고 있어요
  value: number;
  children: ReactNode;
  variant?: TextVariant;
  className?: string;
};

// 손익 숫자. 상승·하락·0을 pnl 토큰 색으로 칠해요(CLAUDE.md "손익 색").
export function PnlText({
  value,
  children,
  variant = 'mono',
  className = '',
}: PnlTextProps) {
  return (
    <Text
      variant={variant}
      className={`${PNL_TEXT_CLASS[getPnlDirection(value)]} ${className}`}
    >
      {children}
    </Text>
  );
}
