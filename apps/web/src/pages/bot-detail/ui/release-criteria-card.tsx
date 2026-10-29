'use client';

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Text,
} from '@xonic0506/sonic-ui';

import type { BotDetailView, ReleaseCriterion } from '@/entities/bot';
import { ReleaseBotButton } from '@/features/bot/release-bot';
import { formatSignedWon } from '@/shared/lib';
import { PnlText } from '@/shared/ui';

import {
  CRITERION_LABEL,
  formatCriterionValue,
  getCriterionRule,
} from '../lib/bot-detail-text';

function CriterionValue({ criterion }: { criterion: ReleaseCriterion }) {
  if (criterion.key === 'net_pnl' && criterion.value !== null) {
    return (
      <PnlText value={criterion.value}>
        {formatSignedWon(criterion.value)}
      </PnlText>
    );
  }
  return <Text variant="mono">{formatCriterionValue(criterion)}</Text>;
}

// 상한 해제 기준 (Figma Bots / CriterionRow, POL-RISK-13). 통과 success, 미달 neutral.
export function ReleaseCriteriaCard({ bot }: { bot: BotDetailView }) {
  const remaining = bot.releaseCriteria.filter(
    (criterion) => !criterion.passed,
  ).length;
  const isReady = remaining === 0 && bot.releaseCriteria.length > 0;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>상한 해제 기준</CardTitle>
        <CardDescription>
          모두 통과하면 투자금 상한을 풀 수 있어요.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <ul className="m-0 flex list-none flex-col p-0">
          {bot.releaseCriteria.map((criterion) => (
            <li
              key={criterion.key}
              className="flex items-center justify-between gap-3 border-b border-default py-2 last:border-b-0"
            >
              <div className="flex flex-col">
                <Text>{CRITERION_LABEL[criterion.key]}</Text>
                <Text variant="caption" tone="muted">
                  {getCriterionRule(criterion)}
                </Text>
              </div>
              <div className="flex items-center gap-3">
                <CriterionValue criterion={criterion} />
                <Badge tone={criterion.passed ? 'success' : 'neutral'}>
                  {criterion.passed ? '통과' : '미달'}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <ReleaseBotButton
            botId={bot.id}
            botName={bot.name}
            budget={bot.budget ?? 0}
            criteriaCount={bot.releaseCriteria.length}
            isReady={isReady}
          />
          <Text as="p" variant="caption" tone="muted">
            {isReady
              ? '모든 기준을 통과했어요. 상한을 풀면 투자금을 다시 정할 수 있어요.'
              : `기준 ${remaining}개가 남았어요. 모두 통과하면 알려 드려요.`}
          </Text>
        </div>
      </CardBody>
    </Card>
  );
}
