import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Text,
} from '@xonic0506/sonic-ui';

import { KillSwitchButton } from '@/features/engine/kill-switch';
import { QueryBoundary } from '@/shared/ui';

import { BotCounts, BotCountsSkeleton } from './bot-counts';
import { KillSwitchAction } from './kill-switch-action';

const BOT_COUNTS_ERROR = '봇 상태를 불러오지 못했어요.';

// 긴급 정지 버튼은 다른 데이터가 실패해도 언제나 누를 수 있어요(api.md 홈).
export function KillSwitchCard() {
  const fallbackButton = <KillSwitchButton isHalted={false} />;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>긴급 정지</CardTitle>
        <CardDescription>
          모든 봇의 신규 주문을 1초 안에 멈춰요.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col justify-between gap-4">
        <QueryBoundary
          loading={<BotCountsSkeleton />}
          errorTitle={BOT_COUNTS_ERROR}
          errorFallback={<Text tone="muted">{BOT_COUNTS_ERROR}</Text>}
        >
          <BotCounts />
        </QueryBoundary>
        <QueryBoundary
          loading={fallbackButton}
          errorTitle="엔진 상태를 불러오지 못했어요"
          errorFallback={fallbackButton}
        >
          <KillSwitchAction />
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}
