'use client';

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  useToast,
} from '@xonic0506/sonic-ui';
import { useState } from 'react';

import { formatWon } from '@/shared/lib';

import { useReleaseBotMutation } from '../hooks/use-release-bot-mutation';

type ReleaseBotButtonProps = {
  botId: string;
  botName: string;
  // 지금 확정 투자금. 상한을 풀어도 그대로예요
  budget: number;
  criteriaCount: number;
  // 기준을 모두 통과했을 때만 누를 수 있어요
  isReady: boolean;
};

// 상한 해제 버튼 + 확인 (Figma Dialog / 상한 해제)
export function ReleaseBotButton({
  botId,
  botName,
  budget,
  criteriaCount,
  isReady,
}: ReleaseBotButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();
  const release = useReleaseBotMutation();

  const handleConfirmClick = () => {
    release.mutate(botId, {
      onSuccess: () => {
        setIsOpen(false);
        toast.add({ title: `${botName}의 상한을 풀었어요`, tone: 'success' });
      },
      onError: () => {
        toast.add({
          title: '상한을 풀지 못했어요',
          description:
            '기준 값이 바뀌었을 수 있어요. 화면을 다시 확인해 주세요.',
          tone: 'danger',
        });
      },
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={<Button className="w-full" disabled={!isReady} />}
      >
        상한 해제
      </AlertDialogTrigger>
      <AlertDialogPopup>
        <AlertDialogTitle>{botName}의 상한을 풀까요?</AlertDialogTitle>
        <AlertDialogDescription className="whitespace-pre-line">
          {`검증 기준 ${criteriaCount}개를 모두 통과했어요.\n상한을 풀어도 투자금은 ${formatWon(budget)} 그대로예요.\n늘리려면 이어서 투자금을 정해요.`}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="secondary" />}>
            취소
          </AlertDialogClose>
          <Button loading={release.isPending} onClick={handleConfirmClick}>
            상한 해제
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
