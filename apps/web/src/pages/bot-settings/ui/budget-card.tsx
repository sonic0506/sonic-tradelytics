'use client';

import {
  Button,
  Card,
  Field,
  formatNumber,
  Input,
  Radio,
  RadioGroup,
  Text,
  useToast,
} from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import { type BotDetailView, formatNotRestingReason } from '@/entities/bot';
import { RebudgetDialog } from '@/features/bot/rebudget-bot';
import { useUpdateBotSettingsMutation } from '@/features/bot/update-bot-settings';
import { formatMonthDayTime, formatWon } from '@/shared/lib';

import { SectionHeader } from './section-header';

const HORIZONTAL_RADIOS =
  '[&_[role=radiogroup]]:flex-row [&_[role=radiogroup]]:gap-4';

const toBudgetText = (budget: BotDetailView['budgetSetting']) =>
  String(budget.type === 'ratio' ? budget.value * 100 : budget.value);

// 시작 전(ready·waiting_funds): 투자금을 바로 고쳐 저장해요 (Figma Bot Settings / 시작 대기)
function EditableBudget({ bot }: { bot: BotDetailView }) {
  const toast = useToast();
  const update = useUpdateBotSettingsMutation();
  const [type, setType] = useState(bot.budgetSetting.type);
  const [value, setValue] = useState(toBudgetText(bot.budgetSetting));
  const [orderAmount, setOrderAmount] = useState(
    String(bot.settings.orderAmount),
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const isRatio = type === 'ratio';
  const budget = Number(value);
  const isBudgetValid =
    value.trim() !== '' && budget > 0 && (!isRatio || budget <= 100);
  const isOrderValid = orderAmount.trim() !== '' && Number(orderAmount) > 0;
  const startText = bot.nextRunAt
    ? `${formatMonthDayTime(bot.nextRunAt)}에 시작할 때`
    : '시작할 때';

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
    if (!isBudgetValid || !isOrderValid) return;
    update.mutate(
      {
        botId: bot.id,
        budget: { type, value: isRatio ? budget / 100 : budget },
        orderAmount: Number(orderAmount),
      },
      {
        onSuccess: () =>
          toast.add({ tone: 'success', title: '투자금을 저장했어요' }),
        onError: () =>
          toast.add({
            tone: 'danger',
            title: '투자금을 저장하지 못했어요',
            description:
              '그사이 봇이 시작됐을 수 있어요. 화면을 새로 고쳐 확인해 주세요.',
          }),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <SectionHeader
        title="투자금"
        description={`시작하기 전이라 투자금을 바로 바꿀 수 있어요. ${startText} 그 시각의 운용 자산 기준으로 확정해요.`}
      />
      <RadioGroup
        label="투자금 방식"
        value={type}
        onValueChange={(next) => {
          setType(next === 'ratio' ? 'ratio' : 'fixed');
          setValue('');
        }}
        className={HORIZONTAL_RADIOS}
      >
        <Radio value="ratio">운용 자산 대비 %</Radio>
        <Radio value="fixed">정액</Radio>
      </RadioGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={isRatio ? '투자금 (%)' : '투자금 (원)'}
          description={
            bot.stage === 'verifying'
              ? `검증 중에는 ${formatWon(bot.capAmount)}까지만 확정해요. 남은 금액은 운용 자산에 그대로 있어요.`
              : undefined
          }
          error={
            isRatio
              ? '0보다 크고 100 이하인 %로 입력해 주세요.'
              : '0보다 큰 금액을 입력해 주세요.'
          }
          invalid={isSubmitted && !isBudgetValid}
        >
          <Input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field
          label="1회 주문 금액 (원)"
          description="투자금 안에서 한 번에 사는 금액이에요."
          error="0보다 큰 금액을 입력해 주세요."
          invalid={isSubmitted && !isOrderValid}
        >
          <Input
            type="number"
            inputMode="numeric"
            value={orderAmount}
            onChange={(event) => setOrderAmount(event.target.value)}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          className="border-default"
          loading={update.isPending}
        >
          투자금 저장
        </Button>
      </div>
    </form>
  );
}

// 운용 중(running·paused): 쉬는 중일 때만 다시 정해요 (Figma Bot Settings / 정상 · 보유 중, POL-FUND-12)
function LockedBudget({ bot }: { bot: BotDetailView }) {
  const [isOpen, setIsOpen] = useState(false);
  const isRatio = bot.budgetSetting.type === 'ratio';
  const isVerifying = bot.stage === 'verifying';
  const notRestingText = formatNotRestingReason(bot);
  const canRebudget = bot.resting && bot.status !== 'stopped';

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="투자금"
        description={
          bot.budget === null
            ? '아직 투자금을 확정하지 않았어요.'
            : `지금 투자금 ${formatWon(bot.budget)}으로 운용하고 있어요.`
        }
      />
      <RadioGroup
        label="투자금 방식"
        value={bot.budgetSetting.type}
        disabled
        className={HORIZONTAL_RADIOS}
      >
        <Radio value="ratio">운용 자산 대비 %</Radio>
        <Radio value="fixed">정액</Radio>
      </RadioGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={isRatio ? '투자금 (%)' : '투자금 (원)'}
          disabled
          {...(isVerifying && bot.budget !== null
            ? {
                description: `검증 중이라 ${formatWon(bot.budget)}만 확정했어요.`,
              }
            : {})}
        >
          <Input
            value={formatNumber(Number(toBudgetText(bot.budgetSetting)))}
            readOnly
          />
        </Field>
        <Field label="1회 주문 금액 (원)" disabled>
          <Input value={formatNumber(bot.settings.orderAmount)} readOnly />
        </Field>
      </div>
      <div role="note" className="flex flex-col gap-1 rounded-md bg-subtle p-3">
        <Text as="p" variant="body-strong">
          {canRebudget
            ? '지금은 쉬는 중이라 다시 정할 수 있어요'
            : '지금은 다시 정할 수 없어요'}
        </Text>
        <Text as="p" variant="caption">
          {canRebudget
            ? `보유 종목과 미체결 주문이 없고 운영 시간(${bot.tradingHours.start}–${bot.tradingHours.end}) 밖이에요. 다시 정하면 지금 투자금과 손익을 돌려받고 새 설정으로 확정해요.`
            : `${notRestingText ?? '지금은 쉬는 중이 아니에요.'} 쉬는 중이 되면 다시 정할 수 있어요.`}
        </Text>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          className="border-default"
          disabled={!canRebudget}
          onClick={() => setIsOpen(true)}
        >
          투자금 다시 정하기
        </Button>
      </div>
      {isOpen && (
        <RebudgetDialog
          botId={bot.id}
          isVerifying={isVerifying}
          capAmount={bot.capAmount}
          cashShare={bot.funds?.cashShare ?? bot.budget ?? 0}
          budget={bot.budgetSetting}
          open={isOpen}
          onOpenChange={setIsOpen}
        />
      )}
    </div>
  );
}

// 투자금 (Figma Card / 투자금). 시작 전이면 바로 고치고, 운용 중이면 다시 정하기로 바꿔요
export function BudgetCard({ bot }: { bot: BotDetailView }) {
  const isBeforeStart =
    bot.status === 'ready' || bot.status === 'waiting_funds';
  return (
    <Card className="gap-4 p-6">
      {isBeforeStart ? (
        <EditableBudget bot={bot} />
      ) : (
        <LockedBudget bot={bot} />
      )}
    </Card>
  );
}
