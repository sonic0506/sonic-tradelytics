'use client';

import {
  Card,
  Checkbox,
  Field,
  Input,
  Radio,
  RadioGroup,
  Select,
  Separator,
  Text,
} from '@xonic0506/sonic-ui';

import type { HoldingAction } from '@/entities/bot';
import {
  type BotDraft,
  type DraftErrors,
  type StartPriority,
  toAllocationPreviewParams,
} from '@/features/bot/create-bot';
import { QueryBoundary } from '@/shared/ui';

import {
  AllocationPreviewCard,
  AllocationPreviewCardSkeleton,
} from './allocation-preview-card';
import { SectionHeader } from './section-header';

const HORIZONTAL_RADIOS =
  '[&_[role=radiogroup]]:flex-row [&_[role=radiogroup]]:flex-wrap [&_[role=radiogroup]]:gap-4';

const PRIORITY_OPTIONS: { value: StartPriority; label: string }[] = [
  { value: 'last', label: '만든 순서대로' },
  { value: 'first', label: '가장 먼저' },
];

const toHoldingAction = (value: string): HoldingAction =>
  value === 'hold' ? 'hold' : 'liquidate';

type StepProps = {
  draft: BotDraft;
  errors: DraftErrors;
  onChange: (patch: Partial<BotDraft>) => void;
};

function fieldError(errors: DraftErrors, key: keyof BotDraft) {
  const error = errors[key];
  return { error, invalid: Boolean(error) };
}

// 2단계: 투자금과 운용 기간·시간, 오른쪽에 예상 배분 (Figma Bot Create / 2 자금·기간)
export function FundsStep({ draft, errors, onChange }: StepProps) {
  const isRatio = draft.budgetType === 'ratio';
  const handleBudgetTypeChange = (value: string) => {
    const budgetType = value === 'fixed' ? 'fixed' : 'ratio';
    // 단위(%·원)가 바뀌어서 값을 비워요
    if (budgetType !== draft.budgetType) {
      onChange({ budgetType, budgetValue: '' });
    }
  };
  const handlePriorityChange = (value: string | null) => {
    const option = PRIORITY_OPTIONS.find((item) => item.value === value);
    if (option) onChange({ startPriority: option.value });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-4">
      <Card className="gap-6 p-6 lg:col-span-2">
        <section className="flex flex-col gap-4">
          <SectionHeader
            title="투자금"
            description="시작할 때 한 번 정하고, 운용 중에는 쉬는 중일 때만 바꿀 수 있어요."
          />
          <RadioGroup
            label="투자금 방식"
            value={draft.budgetType}
            onValueChange={handleBudgetTypeChange}
            className={HORIZONTAL_RADIOS}
          >
            <Radio value="ratio">운용 자산 대비 %</Radio>
            <Radio value="fixed">정액</Radio>
          </RadioGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={isRatio ? '투자금 (%)' : '투자금 (원)'}
              {...fieldError(errors, 'budgetValue')}
            >
              <Input
                type="number"
                inputMode="decimal"
                value={draft.budgetValue}
                onChange={(event) =>
                  onChange({ budgetValue: event.target.value })
                }
              />
            </Field>
            <Field label="시작 우선순위" description="정액 봇에만 써요.">
              <Select
                options={PRIORITY_OPTIONS}
                value={isRatio ? null : draft.startPriority}
                onValueChange={handlePriorityChange}
                placeholder="정률은 먼저 확정돼요"
                disabled={isRatio}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="1회 주문 금액 (원)"
              description="한 번에 사는 금액이에요."
              {...fieldError(errors, 'orderAmount')}
            >
              <Input
                type="number"
                inputMode="numeric"
                value={draft.orderAmount}
                onChange={(event) =>
                  onChange({ orderAmount: event.target.value })
                }
              />
            </Field>
            <Field label="분할 매수 횟수" {...fieldError(errors, 'splitCount')}>
              <Input
                type="number"
                inputMode="numeric"
                value={draft.splitCount}
                onChange={(event) =>
                  onChange({ splitCount: event.target.value })
                }
              />
            </Field>
            <Field
              label="동시 보유 종목 수"
              {...fieldError(errors, 'maxPositions')}
            >
              <Input
                type="number"
                inputMode="numeric"
                value={draft.maxPositions}
                onChange={(event) =>
                  onChange({ maxPositions: event.target.value })
                }
              />
            </Field>
          </div>
        </section>
        <Separator />
        <section className="flex flex-col gap-4">
          <SectionHeader title="운용 기간과 시간" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="시작일" {...fieldError(errors, 'periodStart')}>
              <Input
                type="date"
                value={draft.periodStart}
                onChange={(event) =>
                  onChange({ periodStart: event.target.value })
                }
              />
            </Field>
            <Field
              label="종료일"
              disabled={draft.isIndefinite}
              {...fieldError(errors, 'periodEnd')}
            >
              <Input
                type="date"
                value={draft.periodEnd}
                min={draft.periodStart}
                onChange={(event) =>
                  onChange({ periodEnd: event.target.value })
                }
              />
            </Field>
          </div>
          <Checkbox
            checked={draft.isIndefinite}
            onCheckedChange={(isIndefinite) =>
              onChange({ isIndefinite, periodEnd: '' })
            }
          >
            종료일 없이 계속 운용
          </Checkbox>
          <RadioGroup
            label="종료일에 들고 있는 종목"
            value={draft.onPeriodEnd}
            onValueChange={(value) =>
              onChange({ onPeriodEnd: toHoldingAction(value) })
            }
            disabled={draft.isIndefinite}
            className={HORIZONTAL_RADIOS}
          >
            <Radio value="liquidate">모두 팔기</Radio>
            <Radio value="hold">그대로 두기</Radio>
          </RadioGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="운영 시작" {...fieldError(errors, 'tradingStart')}>
              <Input
                type="time"
                min="09:00"
                max="15:30"
                value={draft.tradingStart}
                onChange={(event) =>
                  onChange({ tradingStart: event.target.value })
                }
              />
            </Field>
            <Field label="운영 종료" {...fieldError(errors, 'tradingEnd')}>
              <Input
                type="time"
                min="09:00"
                max="15:30"
                value={draft.tradingEnd}
                onChange={(event) =>
                  onChange({ tradingEnd: event.target.value })
                }
              />
            </Field>
          </div>
          <Text as="p" variant="caption" tone="muted">
            운영 시간은 정규장 09:00~15:30 안에서 정해요.
          </Text>
        </section>
      </Card>
      <QueryBoundary
        loading={<AllocationPreviewCardSkeleton />}
        errorTitle="예상 배분을 불러오지 못했어요"
        isCompact
        isErrorInCard
      >
        <AllocationPreviewCard
          params={toAllocationPreviewParams(draft)}
          botName={draft.name}
        />
      </QueryBoundary>
    </div>
  );
}
