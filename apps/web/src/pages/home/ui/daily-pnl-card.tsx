import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@xonic0506/sonic-ui';
import type { ReactNode } from 'react';

// 일별 손익 카드 틀. 차트(또는 Skeleton)는 body로 받아요.
export function DailyPnlCard({ children }: { children: ReactNode }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>일별 손익</CardTitle>
        <CardDescription>최근 20거래일 · 봇 전체 합계예요.</CardDescription>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
