'use client';

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Skeleton,
  Text,
} from '@xonic0506/sonic-ui';
import { useDeferredValue } from 'react';

import {
  type AllocationPreview,
  type GetAllocationPreview,
  useAllocationPreviewQuery,
} from '@/entities/allocation';
import {
  formatHourMinute,
  formatMonthDayTime,
  formatRatio,
  formatWon,
} from '@/shared/lib';

type Outcome = AllocationPreview['items'][number]['outcome'];

const OUTCOME_BADGE: Record<
  Outcome,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  confirmed: { label: '확정 예정', tone: 'success' },
  pending: { label: '보류 예정', tone: 'warning' },
  blocked: { label: '저장 불가', tone: 'danger' },
};

type AllocationPreviewCardProps = {
  params: GetAllocationPreview;
  botName: string;
};

// 같은 시각에 시작하는 봇의 예상 확정 금액 (FR-BOT-05, Figma Card / 예상 배분)
// 입력을 바꾸는 동안에는 이전 결과를 보여 주다가 새 결과로 바꿔요.
export function AllocationPreviewCard({
  params,
  botName,
}: AllocationPreviewCardProps) {
  const deferredParams = useDeferredValue(params);
  const { data: preview } = useAllocationPreviewQuery(deferredParams);
  const isOverRatio = preview.ratioTotal > 1;
  const newBotName = `${botName.trim() || '새 봇'} (새 봇)`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>예상 배분</CardTitle>
        <CardDescription>
          {formatMonthDayTime(preview.startAt)}에 함께 시작하는 봇이에요.{' '}
          {formatHourMinute(preview.basedAt)} 운용 자산{' '}
          {formatWon(preview.capital)} 기준이에요.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <ul className="flex flex-col">
          {preview.items.map((item) => {
            const badge = OUTCOME_BADGE[item.outcome];
            return (
              <li
                key={item.botId ?? 'new'}
                className="flex items-center gap-3 border-b border-default py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text className="truncate">{item.name ?? newBotName}</Text>
                  <Text variant="caption" tone="muted">
                    {item.budget.type === 'ratio'
                      ? `정률 ${formatRatio(item.budget.value)}`
                      : `정액 ${formatWon(item.budget.value)}`}
                  </Text>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Text variant="mono">
                    {item.amount === null ? '−' : formatWon(item.amount)}
                  </Text>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
        <Progress
          label="정률 합계"
          value={Math.round(preview.ratioTotal * 100)}
          max={100}
        />
        {isOverRatio && (
          <Text as="p" variant="caption" tone="danger">
            합계 {formatRatio(preview.ratioTotal)}예요. 100%를 넘으면 저장하거나
            시작할 수 없어요.
          </Text>
        )}
        <Text as="p" variant="caption" tone="muted">
          실제 확정은 시작 시각의 운용 자산으로 해요. 금액이 조금 달라질 수
          있어요.
        </Text>
      </CardBody>
    </Card>
  );
}

export function AllocationPreviewCardSkeleton() {
  return (
    <Card aria-busy>
      <CardHeader>
        <CardTitle>예상 배분</CardTitle>
        <Skeleton shape="text" />
      </CardHeader>
      <CardBody>
        <Skeleton shape="rect" />
        <Skeleton shape="rect" />
      </CardBody>
    </Card>
  );
}
