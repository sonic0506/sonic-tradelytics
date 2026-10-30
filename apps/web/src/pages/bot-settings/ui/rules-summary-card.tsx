import {
  Button,
  buttonVariants,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Text,
} from '@xonic0506/sonic-ui';
import NextLink from 'next/link';

import { type BotDetailView, formatNotRestingReason } from '@/entities/bot';
import { formatMonthDayTime } from '@/shared/lib';

// 지금 쓰는 규칙 값과 바꾸기 (Figma Card / 규칙 값)
export function RulesSummaryCard({ bot }: { bot: BotDetailView }) {
  const { ruleVersion, pendingVersion } = bot;
  const notRestingText = formatNotRestingReason(bot);
  return (
    <Card>
      <CardHeader>
        <CardTitle>규칙 값</CardTitle>
        <CardDescription>
          v{ruleVersion.version} · {formatMonthDayTime(ruleVersion.appliedAt)}
          부터 써요. 바꾸면 새 버전으로 저장해요.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <dl className="flex flex-col gap-2">
          {ruleVersion.values.map((rule) => (
            <div key={rule.label} className="flex items-center gap-3">
              <dt className="flex-1 text-body text-muted">{rule.label}</dt>
              <dd className="font-mono text-body text-default">
                {rule.display}
              </dd>
            </div>
          ))}
        </dl>
        {pendingVersion !== null ? (
          <div
            role="note"
            className="flex flex-col gap-1 rounded-md bg-subtle p-3"
          >
            <Text as="p" variant="body-strong">
              v{pendingVersion}를 적용 대기 중이에요
            </Text>
            <Text as="p" variant="caption">
              {notRestingText ?? '지금은 쉬는 중이 아니에요.'} 쉬는 중이 되면
              바로 적용해요. 적용되기 전에는 규칙 값을 다시 바꿀 수 없어요.
            </Text>
          </div>
        ) : (
          <Text as="p" variant="caption" tone="muted">
            {bot.resting
              ? '쉬는 중이라 바꾸면 바로 적용돼요.'
              : `${notRestingText ?? '지금은 쉬는 중이 아니에요.'} 쉬는 중이 되면 적용돼요.`}
          </Text>
        )}
        {pendingVersion !== null ? (
          <Button
            variant="secondary"
            className="w-full border-default"
            disabled
          >
            규칙 값 바꾸기
          </Button>
        ) : (
          <NextLink
            href={`/bots/${encodeURIComponent(bot.id)}/rules`}
            className={`${buttonVariants({ variant: 'secondary' })} w-full border-default`}
          >
            규칙 값 바꾸기
          </NextLink>
        )}
      </CardBody>
    </Card>
  );
}
