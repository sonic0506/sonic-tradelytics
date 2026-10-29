import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@xonic0506/sonic-ui';
import type { ReactNode } from 'react';

type ActivityCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

// 오늘 체결·리스크 이벤트 카드 틀
export function ActivityCard({
  title,
  description,
  children,
}: ActivityCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
