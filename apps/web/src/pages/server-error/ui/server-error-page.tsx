'use client';

import { Button, ErrorPage } from '@xonic0506/sonic-ui';
import { RefreshCw } from 'lucide-react';

type ServerErrorPageProps = {
  // Next error.tsx가 넘겨주는 다시 그리기
  reset: () => void;
};

// 페이지를 그리지 못했을 때 (DESIGN.md ErrorPage 500). 일시적인 실패가 많아서
// 홈으로 보내지 않고 그 자리에서 다시 시도해요
export function ServerErrorPage({ reset }: ServerErrorPageProps) {
  return (
    <ErrorPage
      status={500}
      action={
        <Button onClick={reset}>
          <RefreshCw />
          다시 시도
        </Button>
      }
    />
  );
}
