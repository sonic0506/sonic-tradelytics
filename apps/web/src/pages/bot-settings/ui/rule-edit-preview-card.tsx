'use client';

import {
  Button,
  buttonVariants,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Skeleton,
  Text,
} from '@xonic0506/sonic-ui';
import { TriangleAlert } from 'lucide-react';
import NextLink from 'next/link';
import { useDeferredValue } from 'react';

import {
  type BotDetailView,
  formatNotRestingReason,
  type GetVersionPreview,
  useVersionPreviewQuery,
  type VersionPreview,
} from '@/entities/bot';
import { formatWon } from '@/shared/lib';

type RuleEditPreviewCardProps = {
  bot: BotDetailView;
  params: GetVersionPreview;
  isSaving: boolean;
};

function getTimingText(bot: BotDetailView, preview: VersionPreview) {
  if (preview.applyTiming === 'now')
    return '지금 쉬는 중이라 저장하면 바로 적용돼요.';
  return `${formatNotRestingReason(bot) ?? '지금은 쉬는 중이 아니에요.'} 쉬는 중이 되면 적용돼요.`;
}

function getRecordText(bot: BotDetailView) {
  const closed =
    bot.releaseCriteria.find((criterion) => criterion.key === 'closed_trades')
      ?.value ?? 0;
  return `${bot.tradingDays}거래일·청산 ${closed}건`;
}

// 저장하면 어떻게 되는지 (Figma 규칙 값 바꾸기 / 저장하면, FR-BOT-11)
export function RuleEditPreviewCard({
  bot,
  params,
  isSaving,
}: RuleEditPreviewCardProps) {
  const deferredParams = useDeferredValue(params);
  const { data: preview } = useVersionPreviewQuery(deferredParams);
  const version = bot.ruleVersion.version;
  const isDecision = preview.changeKind === 'decision_change';

  return (
    <Card>
      <CardHeader>
        <CardTitle>저장하면</CardTitle>
      </CardHeader>
      <CardBody>
        {preview.changeKind === null ? (
          <Text as="p" tone="muted">
            바꾼 값이 없어요. 숫자를 바꾸면 저장했을 때 어떻게 되는지 알려
            드려요.
          </Text>
        ) : (
          <div
            role="note"
            className={`flex flex-col gap-2 rounded-md p-3 ${
              isDecision
                ? 'border border-warning bg-warning-subtle'
                : 'bg-subtle'
            }`}
          >
            <p
              className={`flex items-center gap-2 text-body-strong ${isDecision ? 'text-warning' : 'text-default'}`}
            >
              {isDecision && <TriangleAlert className="size-4" aria-hidden />}
              {isDecision
                ? '판단이 바뀌는 변경이에요'
                : '위험만 줄이는 변경이에요'}
            </p>
            <ul className="flex flex-col gap-2 text-caption text-default">
              <li>
                ·{' '}
                {isDecision
                  ? `검증 구간을 처음부터 다시 시작해요. v${version}의 ${getRecordText(bot)} 기록은 v${version}에 남아요.`
                  : `검증 기록을 이어서 써요. 지금 ${getRecordText(bot)}이 그대로 이어져요.`}
              </li>
              <li>· {getTimingText(bot, preview)}</li>
              {preview.reconfirmsAtCap && (
                <li>
                  · 적용할 때 투자금을 상한 {formatWon(bot.capAmount)}으로 다시
                  확정해요.
                </li>
              )}
            </ul>
          </div>
        )}
        {preview.changes.length > 0 && (
          <div className="flex flex-col gap-2">
            <Text as="p" variant="caption" tone="muted">
              바뀐 값
            </Text>
            <dl className="flex flex-col gap-2">
              {preview.changes.map((change) => (
                <div key={change.label} className="flex items-center gap-3">
                  <dt className="flex-1 text-body text-muted">
                    {change.label}
                  </dt>
                  <dd className="font-mono text-body text-default">
                    {change.from} → {change.to}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <NextLink
            href={`/bots/${encodeURIComponent(bot.id)}/settings`}
            className={`${buttonVariants({ variant: 'secondary' })} border-default`}
          >
            취소
          </NextLink>
          <Button
            type="submit"
            disabled={preview.changeKind === null}
            loading={isSaving}
          >
            v{version + 1}로 저장
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function RuleEditPreviewCardSkeleton() {
  return (
    <Card aria-busy>
      <CardHeader>
        <CardTitle>저장하면</CardTitle>
      </CardHeader>
      <CardBody>
        <Skeleton shape="rect" />
      </CardBody>
    </Card>
  );
}
