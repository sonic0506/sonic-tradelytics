'use client';

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogPopup,
  AlertDialogTitle,
  Button,
  useToast,
} from '@xonic0506/sonic-ui';

import { useBotCommandMutation } from '../hooks/use-bot-command-mutation';

type LiquidateBotDialogProps = {
  botId: string;
  botName: string;
  // 무엇을 파는지. 모르면 일반 문구를 써요(상세 화면은 종목과 수량을 넘겨요)
  holdingsText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// 전량 청산 (Figma Dialog / 전량 청산). 되돌릴 수 없어서 한 번 더 물어요.
export function LiquidateBotDialog({
  botId,
  botName,
  holdingsText = '보유 종목을 모두 지금 시장가로 팔아요.',
  open,
  onOpenChange,
}: LiquidateBotDialogProps) {
  const toast = useToast();
  const command = useBotCommandMutation();

  const handleConfirmClick = () => {
    command.mutate(
      { botId, kind: 'liquidate' },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.add({
            title: `${botName}의 전량 청산을 보냈어요`,
            tone: 'success',
          });
        },
        onError: () => {
          toast.add({
            title: '전량 청산을 보내지 못했어요',
            description: '네트워크 연결을 확인하고 다시 눌러 주세요.',
            tone: 'danger',
          });
        },
      },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup>
        <AlertDialogTitle>
          {botName}의 보유 종목을 모두 팔까요?
        </AlertDialogTitle>
        <AlertDialogDescription className="whitespace-pre-line">
          {`${holdingsText}\n체결되면 되돌릴 수 없어요.`}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="secondary" />}>
            취소
          </AlertDialogClose>
          <Button
            variant="danger"
            loading={command.isPending}
            onClick={handleConfirmClick}
          >
            전량 청산
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
