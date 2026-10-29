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
  useToast,
} from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import { formatWon } from '@/shared/lib';

import { useRestartWithBudgetMutation } from '../hooks/use-restart-with-budget-mutation';
import { type BudgetError, getBudgetError } from '../lib/validate-budget';

type RestartWithBudgetDialogProps = {
  botId: string;
  botName: string;
  // 확정에 필요한 금액과 지금 쓸 수 있는 운용 자산
  required: number;
  available: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getErrorText(error: BudgetError, available: number) {
  switch (error) {
    case 'not_positive_integer':
      return '1원 이상의 금액을 숫자로 입력해 주세요.';
    case 'over_available':
      return `${formatWon(available)} 이하로 입력해 주세요.`;
  }
}

// 투자금 줄이고 다시 시작 (Figma Dialog / 투자금 줄이고 다시 시작, FR-BOT-10)
export function RestartWithBudgetDialog({
  botId,
  botName,
  required,
  available,
  open,
  onOpenChange,
}: RestartWithBudgetDialogProps) {
  const [value, setValue] = useState(String(available));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const toast = useToast();
  const restart = useRestartWithBudgetMutation();
  const error = getBudgetError(value, available);
  const isInvalid = isSubmitted && error !== null;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
    if (error !== null) return;
    const amount = Number(value);
    restart.mutate(
      { botId, amount },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.add({
            title: `투자금을 ${formatWon(amount)}으로 줄이고 다시 시작했어요`,
            tone: 'success',
          });
        },
        onError: () => {
          toast.add({
            title: '다시 시작하지 못했어요',
            description:
              '운용 자산이 바뀌었을 수 있어요. 금액을 확인하고 다시 눌러 주세요.',
            tone: 'danger',
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogTitle>투자금을 줄이고 다시 시작할까요?</DialogTitle>
        <DialogDescription>
          {botName} 봇은 자금이 {formatWon(required - available)} 모자라
          기다리는 중이에요. 지금 쓸 수 있는 운용 자산은 {formatWon(available)}
          이에요.
        </DialogDescription>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <Field
            label="투자금 (원)"
            description={`${formatWon(available)} 이하로 정하면 바로 시작해요.`}
            error={error === null ? '' : getErrorText(error, available)}
            invalid={isInvalid}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>
              취소
            </DialogClose>
            <Button type="submit" loading={restart.isPending}>
              다시 시작
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
