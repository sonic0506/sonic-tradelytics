import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Text,
} from '@xonic0506/sonic-ui';

import type { DecisionTimeline } from '@/entities/position';
import { formatMonthDayTime } from '@/shared/lib';

// 재평가 기록: 판단마다 수정한 예측을 시간순으로 (Figma Rationale / 재평가 기록)
export function ReevalTimelineCard({
  timeline,
}: {
  timeline: DecisionTimeline;
}) {
  if (timeline.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>재평가 기록</CardTitle>
        <CardDescription>
          날짜를 넘기는 봇은 재평가할 때마다 수정한 예측을 시간순으로 남겨요.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <ol className="flex flex-col">
          {timeline.map((item, index) => (
            <li key={`${item.at}-${item.kind}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={`mt-1 size-2 shrink-0 rounded-full ${
                    item.kind === 'reeval'
                      ? 'bg-current text-muted'
                      : 'bg-inverse'
                  }`}
                />
                {index < timeline.length - 1 && (
                  <span
                    aria-hidden
                    className="flex-1 border-l border-default"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1 pb-5">
                <p className="flex flex-wrap items-baseline gap-2">
                  <Text variant="mono-caption" tone="muted">
                    {formatMonthDayTime(item.at)}
                  </Text>
                  <Text variant="body-strong">{item.title}</Text>
                </p>
                <Text as="p" tone="muted">
                  {item.detail}
                </Text>
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
