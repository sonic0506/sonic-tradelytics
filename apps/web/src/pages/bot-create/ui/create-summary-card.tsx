import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Text,
} from '@xonic0506/sonic-ui';

import {
  BOT_TYPE_LABEL,
  type BotDefaults,
  RISK_PROFILE_LABEL,
} from '@/entities/bot';
import type { BotDraft } from '@/features/bot/create-bot';
import { formatMonthDay, formatWon } from '@/shared/lib';

import { isRuleChanged } from '../lib/bot-create-copy';

const formatLoss = (text: string) => `−${Math.abs(Number(text))}%`;

function getSummaryRows(draft: BotDraft, defaults: BotDefaults) {
  const budget = Number(draft.budgetValue);
  const cap = defaults.capAmount;
  const isRatio = draft.budgetType === 'ratio';
  const changedRules = defaults.rules.filter((field) =>
    isRuleChanged(field, draft.rules[field.key] ?? ''),
  ).length;
  const periodEnd = draft.isIndefinite
    ? '계속'
    : formatMonthDay(draft.periodEnd);
  return [
    ['이름', draft.name.trim()],
    [
      '유형 · 성향',
      `${BOT_TYPE_LABEL[draft.type]} · ${RISK_PROFILE_LABEL[draft.riskProfile]}`,
    ],
    ['투자금', isRatio ? `정률 ${budget}%` : `정액 ${formatWon(budget)}`],
    [
      '처음 확정',
      isRatio || budget > cap
        ? `${formatWon(cap)}까지 (검증 상한)`
        : formatWon(budget),
    ],
    ['1회 주문', formatWon(Number(draft.orderAmount))],
    ['운용 기간', `${formatMonthDay(draft.periodStart)} ~ ${periodEnd}`],
    ['운영 시간', `${draft.tradingStart} ~ ${draft.tradingEnd}`],
    ['바꾼 규칙 값', `${changedRules}개`],
    [
      '손실 중지',
      `${formatLoss(draft.firstLossPct)} / ${formatLoss(draft.totalLossPct)}`,
    ],
  ];
}

type CreateSummaryCardProps = { draft: BotDraft; defaults: BotDefaults };

// 만들기 전에 고른 값을 한눈에 보여 줘요 (Figma Bot Create / 4 안전장치 · 만들 봇)
export function CreateSummaryCard({ draft, defaults }: CreateSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>만들 봇</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="flex flex-col gap-2">
          {getSummaryRows(draft, defaults).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-body text-muted">{label}</dt>
              <dd className="text-right text-body text-default">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-1 rounded-md bg-subtle p-3">
          <Text as="p" variant="body-strong">
            검증 구간으로 시작해요
          </Text>
          <Text as="p" variant="caption" tone="muted">
            10거래일, 청산 30건, 순손익, 손익비, MDD 기준을 모두 통과하면 상한을
            풀 수 있어요.
          </Text>
        </div>
      </CardBody>
    </Card>
  );
}
