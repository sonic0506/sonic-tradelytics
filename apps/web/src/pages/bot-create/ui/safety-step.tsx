'use client';

import {
  Card,
  Field,
  Input,
  Radio,
  RadioGroup,
  Separator,
} from '@xonic0506/sonic-ui';

import { type BotDefaults, LOSS_SCOPE_LABEL } from '@/entities/bot';
import type { BotDraft, DraftErrors } from '@/features/bot/create-bot';
import { formatWon } from '@/shared/lib';

import { FIRST_LOSS_EFFECT } from '../lib/bot-create-copy';
import { CreateSummaryCard } from './create-summary-card';
import { SectionHeader } from './section-header';

type SafetyStepProps = {
  draft: BotDraft;
  defaults: BotDefaults;
  errors: DraftErrors;
  onChange: (patch: Partial<BotDraft>) => void;
};

// 손실 금액은 검증 구간에서 처음 확정하는 투자금으로 계산해요 (상한보다 작은 정액이면 그 금액)
function getLossBasis(draft: BotDraft, capAmount: number) {
  const budget = Number(draft.budgetValue);
  return draft.budgetType === 'fixed' && budget > 0
    ? Math.min(budget, capAmount)
    : capAmount;
}

function describeLoss(basis: number, text: string, effect: string) {
  const percent = Math.abs(Number(text));
  if (!Number.isFinite(percent) || percent === 0) return undefined;
  return `${formatWon(Math.round((basis * percent) / 100))}을 잃으면 ${effect}.`;
}

// 4단계: 손실 중지·연속 손절·한도 도달 처리, 오른쪽에 만들 봇 요약 (Figma Bot Create / 4 안전장치)
export function SafetyStep({
  draft,
  defaults,
  errors,
  onChange,
}: SafetyStepProps) {
  const basis = getLossBasis(draft, defaults.capAmount);
  const streak = Number(draft.stopStreak);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-4">
      <Card className="gap-6 p-6 lg:col-span-2">
        <section className="flex flex-col gap-4">
          <SectionHeader
            title="손실 중지"
            description={`수수료·세금을 뺀 손실로 계산해요. 투자금 ${formatWon(basis)} 기준이에요.`}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`${LOSS_SCOPE_LABEL[draft.type]} 손실 한도 (%)`}
              description={describeLoss(
                basis,
                draft.firstLossPct,
                FIRST_LOSS_EFFECT[draft.type],
              )}
              error={errors.firstLossPct}
              invalid={Boolean(errors.firstLossPct)}
            >
              <Input
                type="number"
                step="any"
                value={draft.firstLossPct}
                onChange={(event) =>
                  onChange({ firstLossPct: event.target.value })
                }
              />
            </Field>
            <Field
              label="누적 손실 한도 (%)"
              description={describeLoss(
                basis,
                draft.totalLossPct,
                '봇을 끝내요',
              )}
              error={errors.totalLossPct}
              invalid={Boolean(errors.totalLossPct)}
            >
              <Input
                type="number"
                step="any"
                value={draft.totalLossPct}
                onChange={(event) =>
                  onChange({ totalLossPct: event.target.value })
                }
              />
            </Field>
          </div>
        </section>
        <Separator />
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SectionHeader title="연속 손절" />
            <Field
              label="연속 손절 횟수"
              description={
                streak > 0
                  ? `${streak}번 연속 손절하면 일시정지하고 알려 드려요.`
                  : undefined
              }
              error={errors.stopStreak}
              invalid={Boolean(errors.stopStreak)}
            >
              <Input
                type="number"
                inputMode="numeric"
                value={draft.stopStreak}
                onChange={(event) =>
                  onChange({ stopStreak: event.target.value })
                }
              />
            </Field>
          </div>
        </section>
        <Separator />
        <RadioGroup
          label="한도에 닿았을 때 들고 있는 종목"
          value={draft.onDailyLimit}
          onValueChange={(value) =>
            onChange({ onDailyLimit: value === 'hold' ? 'hold' : 'liquidate' })
          }
          className="[&_[role=radiogroup]]:flex-row [&_[role=radiogroup]]:gap-4"
        >
          <Radio value="liquidate">바로 팔기</Radio>
          <Radio value="hold">그대로 두기</Radio>
        </RadioGroup>
      </Card>
      <CreateSummaryCard draft={draft} defaults={defaults} />
    </div>
  );
}
