'use client';

import { Button } from '@xonic0506/sonic-ui';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

// 목록 화면 필터(Figma App / FilterField · FilterActions).
// 데스크톱은 한 줄, 좁은 화면은 칸마다 한 줄씩 쌓고 위아래 1px 선으로 묶어요.
export function FilterPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex border-y border-default max-sm:flex-col ${className}`}
    >
      {children}
    </div>
  );
}

type FilterFieldProps = {
  label: string;
  children: ReactNode;
};

// 회색 라벨 칸 + 입력 칸. 입력 컨트롤에는 aria-label로 같은 라벨을 달아요.
export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div className="flex flex-1 max-sm:border-b max-sm:border-default max-sm:last:border-b-0">
      <span
        aria-hidden
        className="flex w-28 shrink-0 items-center bg-subtle px-4 text-label text-default max-sm:w-22"
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center bg-surface p-2">
        {children}
      </div>
    </div>
  );
}

type FilterActionsProps = {
  onReset: () => void;
  onApply: () => void;
};

// 초기화(모든 칸을 기본값으로)와 조회하기(URL에 반영). primary는 페이지 동작에 남겨 둬요.
export function FilterActions({ onReset, onApply }: FilterActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RefreshCw />
        초기화
      </Button>
      <Button variant="secondary" size="sm" onClick={onApply}>
        조회하기
      </Button>
    </div>
  );
}
