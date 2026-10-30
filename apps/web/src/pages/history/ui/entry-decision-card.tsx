import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Text,
} from '@xonic0506/sonic-ui';
import { ScrollText } from 'lucide-react';

import type { EntryDecision } from '@/entities/position';
import {
  formatMonthDay,
  formatTime,
  formatWon,
  toTradeDate,
} from '@/shared/lib';

import { DIRECTION_LABEL, formatRate } from '../lib/rationale-text';

function Meta({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="mono">{children}</Text>
    </div>
  );
}

type EntryDecisionCardProps = {
  entry: EntryDecision | null;
  botLabel: string;
};

// 진입 판단: 판단 시점·조건·예측 (Figma Rationale / 진입 판단, F3 근거 카드)
export function EntryDecisionCard({ entry, botLabel }: EntryDecisionCardProps) {
  if (!entry) {
    return (
      <Card>
        <EmptyState
          icon={<ScrollText />}
          title="판단 기록이 없는 거래예요"
          description="직접 거래는 봇이 판단하지 않아서 근거 카드가 없어요."
        />
      </Card>
    );
  }
  const { prediction } = entry;
  return (
    <Card>
      <CardHeader>
        <CardTitle>진입 판단</CardTitle>
        <CardDescription>
          주문 직전에 남긴 근거예요. 규칙과 숫자로만 기록해요.
        </CardDescription>
      </CardHeader>
      <CardBody className="gap-6">
        <div className="grid grid-cols-3 gap-4">
          <Meta label="판단 시각">
            {`${formatMonthDay(toTradeDate(new Date(entry.decidedAt)))} ${formatTime(entry.decidedAt)}`}
          </Meta>
          <Meta label="봇">{botLabel}</Meta>
          <Meta label="당시 가격">{formatWon(entry.price)}</Meta>
        </div>
        <div className="flex flex-col gap-2">
          <Text variant="caption" tone="muted">
            조건
          </Text>
          <ul className="flex flex-col">
            {entry.conditions.map((condition) => (
              <li
                key={condition.label}
                className="flex items-center gap-3 border-b border-default py-2 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text>{condition.label}</Text>
                  <Text variant="caption" tone="muted">
                    {condition.rule}
                  </Text>
                </div>
                <Text variant="mono">{condition.value}</Text>
                <Badge tone={condition.passed ? 'success' : 'neutral'}>
                  {condition.passed ? '충족' : '탈락'}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <Text variant="caption" tone="muted">
            예측
          </Text>
          <div className="grid grid-cols-2 gap-4">
            <Meta label="방향">{DIRECTION_LABEL[prediction.direction]}</Meta>
            <Meta label="목표가">
              {`${formatWon(prediction.targetPrice)} (${formatRate(prediction.targetRate)})`}
            </Meta>
            <Meta label="손절가">
              {`${formatWon(prediction.stopPrice)} (${formatRate(prediction.stopRate)})`}
            </Meta>
            <Meta label="예상 보유">{prediction.holdUntil}</Meta>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
