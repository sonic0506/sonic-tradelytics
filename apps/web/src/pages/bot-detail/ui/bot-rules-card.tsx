import {
  buttonVariants,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Text,
} from '@xonic0506/sonic-ui';
import NextLink from 'next/link';

import type { BotDetailView } from '@/entities/bot';
import { toTradeDate } from '@/shared/lib';

// 지금 쓰는 규칙 값과 버전 (FR-BOT-03). 바꾸기는 설정 화면에서 해요.
export function BotRulesCard({ bot }: { bot: BotDetailView }) {
  const { version, appliedAt, values } = bot.ruleVersion;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>규칙 값</CardTitle>
        <CardDescription>
          v{version} · {toTradeDate(new Date(appliedAt))}부터 써요.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <dl className="m-0 flex flex-col gap-2">
          {values.map(({ label, display }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4"
            >
              <Text as="div" tone="muted">
                <dt>{label}</dt>
              </Text>
              <dd className="m-0 font-mono text-body text-default">
                {display}
              </dd>
            </div>
          ))}
        </dl>
        {bot.status !== 'stopped' && (
          <NextLink
            href={`/bots/${bot.id}/settings`}
            // sonic-ui 0.6.2 buttonVariants는 border-transparent가 남아 secondary 테두리가 사라져요. border-default로 덮어써요.
            className={`${buttonVariants({ variant: 'secondary' })} w-full border-default`}
          >
            규칙 값 바꾸기
          </NextLink>
        )}
      </CardBody>
    </Card>
  );
}
