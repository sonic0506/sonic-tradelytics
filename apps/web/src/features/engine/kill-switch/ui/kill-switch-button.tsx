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
  Checkbox,
  useToast,
} from '@xonic0506/sonic-ui';
import { useState } from 'react';

import { useKillSwitchMutation } from '../hooks/use-kill-switch-mutation';

type KillSwitchButtonProps = {
  // 엔진이 이미 전체 정지 상태면 누를 수 없어요
  isHalted: boolean;
};

// 긴급 정지(킬 스위치). 되돌릴 수 없는 동작이라 AlertDialog로 한 번 더 물어요.
export function KillSwitchButton({ isHalted }: KillSwitchButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLiquidateAllChecked, setIsLiquidateAllChecked] = useState(false);
  const toast = useToast();
  const killSwitch = useKillSwitchMutation();

  const handleConfirmClick = () => {
    killSwitch.mutate(
      { liquidateAll: isLiquidateAllChecked },
      {
        onSuccess: () => {
          setIsOpen(false);
          toast.add({
            title: '모든 봇을 멈췄어요',
            description: isLiquidateAllChecked
              ? '보유 종목 청산 주문도 함께 보냈어요.'
              : '봇마다 다시 시작해야 신규 주문이 나가요.',
            tone: 'success',
          });
        },
        onError: () => {
          toast.add({
            title: '긴급 정지를 보내지 못했어요',
            description: '네트워크 연결을 확인하고 다시 눌러 주세요.',
            tone: 'danger',
          });
        },
      },
    );
  };

  if (isHalted) {
    return (
      <Button variant="danger" size="lg" className="w-full" disabled>
        정지됨
      </Button>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={<Button variant="danger" size="lg" className="w-full" />}
      >
        모두 정지
      </AlertDialogTrigger>
      <AlertDialogPopup>
        <AlertDialogTitle>모든 봇을 멈출까요?</AlertDialogTitle>
        <AlertDialogDescription>
          모든 봇의 신규 주문이 1초 안에 멈춰요. 다시 돌리려면 봇마다 다시
          시작해야 해요.
        </AlertDialogDescription>
        <Checkbox
          checked={isLiquidateAllChecked}
          onCheckedChange={setIsLiquidateAllChecked}
        >
          보유 종목도 모두 청산하기
        </Checkbox>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="secondary" />}>
            취소
          </AlertDialogClose>
          <Button
            variant="danger"
            loading={killSwitch.isPending}
            onClick={handleConfirmClick}
          >
            모두 정지
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
