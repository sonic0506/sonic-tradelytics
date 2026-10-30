'use client';

import {
  Button,
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogTitle,
  Field,
  Input,
  Radio,
  RadioGroup,
  useToast,
} from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import { HttpError } from '@/shared/api';
import { formatWon } from '@/shared/lib';

import { useRebudgetBotMutation } from '../hooks/use-rebudget-bot-mutation';

type RebudgetDialogProps = {
  botId: string;
  isVerifying: boolean;
  capAmount: number;
  // 돌려받을 지금 투자금과 손익
  cashShare: number;
  budget: { type: 'ratio' | 'fixed'; value: number };
  orderAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const toInputText = (budget: RebudgetDialogProps['budget']) =>
  String(budget.type === 'ratio' ? budget.value * 100 : budget.value);

function getFailureText(error: Error) {
  const code = error instanceof HttpError ? error.code : null;
  if (code === 'BOT_NOT_RESTING') {
    return '그사이 보유 종목이 생겼거나 운영 시간이 됐어요. 쉬는 중이 된 뒤 다시 정해 주세요.';
  }
  if (code === 'BUDGET_INSUFFICIENT') {
    return '새 금액을 확정할 운용 자산이 모자라요. 금액을 줄여 다시 정해 주세요. 지금 투자금은 그대로예요.';
  }
  return '잠시 뒤 다시 시도해 주세요. 지금 투자금은 그대로예요.';
}

// 투자금 다시 정하기 (Figma Dialog / 투자금 다시 정하기, FR-BOT-09)
export function RebudgetDialog({
  botId,
  isVerifying,
  capAmount,
  cashShare,
  budget,
  orderAmount,
  open,
  onOpenChange,
}: RebudgetDialogProps) {
  const toast = useToast();
  const rebudget = useRebudgetBotMutation();
  const [type, setType] = useState(budget.type);
  const [value, setValue] = useState(toInputText(budget));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const isRatio = type === 'ratio';
  const amount = Number(value);
  const isValid =
    value.trim() !== '' && amount > 0 && (!isRatio || amount <= 100);
  const error = isRatio
    ? '0보다 크고 100 이하인 %로 입력해 주세요.'
    : '0보다 큰 금액을 입력해 주세요.';

  const handleTypeChange = (next: string) => {
    setType(next === 'ratio' ? 'ratio' : 'fixed');
    setValue('');
  };
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
    if (!isValid) return;
    rebudget.mutate(
      {
        botId,
        budget: { type, value: isRatio ? amount / 100 : amount, orderAmount },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.add({
            tone: 'success',
            title: '투자금을 다시 정했어요',
            description: '엔진이 쉬는 중인지 한 번 더 확인하고 확정해요.',
          });
        },
        onError: (failure) => {
          toast.add({
            tone: 'danger',
            title: '투자금을 다시 정하지 못했어요',
            description: getFailureText(failure),
          });
        },
      },
    );
  };

  const description = isVerifying
    ? `지금 투자금과 손익 ${formatWon(cashShare)}을 돌려받고 새 설정으로 다시 확정해요. 검증 중이라 확정은 상한 ${formatWon(capAmount)}까지예요.`
    : `상한을 풀었어요. 지금 투자금과 손익 ${formatWon(cashShare)}을 돌려받고, 운용 자산 안에서 새로 확정해요.`;
  const fieldDescription =
    isVerifying && !isRatio && amount > capAmount
      ? `${formatWon(amount)}으로 정해도 상한을 풀기 전에는 ${formatWon(capAmount)}만 확정해요.`
      : '1회 주문 금액과 손실 한도도 이 금액 기준으로 바뀌어요.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogTitle>투자금 다시 정하기</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <RadioGroup
            label="투자금 방식"
            value={type}
            onValueChange={handleTypeChange}
            className="[&_[role=radiogroup]]:flex-row [&_[role=radiogroup]]:gap-4"
          >
            <Radio value="ratio">운용 자산 대비 %</Radio>
            <Radio value="fixed">정액</Radio>
          </RadioGroup>
          <Field
            label={isRatio ? '투자금 (%)' : '투자금 (원)'}
            description={fieldDescription}
            error={error}
            invalid={isSubmitted && !isValid}
          >
            <Input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>
              나중에
            </DialogClose>
            <Button type="submit" loading={rebudget.isPending}>
              다시 정하기
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
