'use client';

import {
  Button,
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
  useToast,
} from '@xonic0506/sonic-ui';
import { Ellipsis } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { BotListRow } from '@/entities/bot';
import {
  type BotCommandKind,
  LiquidateBotDialog,
  useBotCommandMutation,
} from '@/features/bot/control-bot';
import { RestartWithBudgetDialog } from '@/features/bot/restart-with-budget';

const COMMAND_DONE: Record<'pause' | 'resume', string> = {
  pause: '일시정지했어요',
  resume: '다시 시작했어요',
};

type OpenDialog = 'liquidate' | 'restart' | null;

// 더 보기 메뉴 (Figma Bots / BotRow). 종료된 봇은 할 수 있는 동작이 없어 메뉴를 두지 않아요.
export function BotRowMenu({ bot }: { bot: BotListRow }) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const router = useRouter();
  const toast = useToast();
  const command = useBotCommandMutation();

  if (bot.status === 'stopped') return null;

  const isTrading = bot.status === 'running' || bot.status === 'paused';
  const isBeforeStart =
    bot.status === 'waiting_funds' || bot.status === 'ready';

  const sendCommand = (kind: Extract<BotCommandKind, 'pause' | 'resume'>) => {
    command.mutate(
      { botId: bot.id, kind },
      {
        onSuccess: () =>
          toast.add({
            title: `${bot.name} 봇을 ${COMMAND_DONE[kind]}`,
            tone: 'success',
          }),
        onError: () =>
          toast.add({
            title: '명령을 보내지 못했어요',
            description: '네트워크 연결을 확인하고 다시 눌러 주세요.',
            tone: 'danger',
          }),
      },
    );
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) setOpenDialog(null);
  };

  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`${bot.name} 더 보기`}
            />
          }
        >
          <Ellipsis />
        </MenuTrigger>
        <MenuPopup>
          {bot.status === 'running' && (
            <MenuItem onClick={() => sendCommand('pause')}>일시정지</MenuItem>
          )}
          {bot.status === 'paused' && (
            <MenuItem onClick={() => sendCommand('resume')}>재개</MenuItem>
          )}
          {isTrading && <MenuSeparator />}
          {isTrading && (
            <MenuItem tone="danger" onClick={() => setOpenDialog('liquidate')}>
              전량 청산
            </MenuItem>
          )}
          {bot.status === 'waiting_funds' && bot.fundShortfall && (
            <MenuItem onClick={() => setOpenDialog('restart')}>
              투자금 줄이고 다시 시작
            </MenuItem>
          )}
          {isBeforeStart && (
            <MenuItem onClick={() => router.push(`/bots/${bot.id}/settings`)}>
              설정
            </MenuItem>
          )}
        </MenuPopup>
      </Menu>
      {isTrading && (
        <LiquidateBotDialog
          botId={bot.id}
          botName={bot.name}
          open={openDialog === 'liquidate'}
          onOpenChange={handleDialogOpenChange}
        />
      )}
      {bot.fundShortfall && (
        <RestartWithBudgetDialog
          botId={bot.id}
          botName={bot.name}
          required={bot.fundShortfall.required}
          available={bot.fundShortfall.available}
          open={openDialog === 'restart'}
          onOpenChange={handleDialogOpenChange}
        />
      )}
    </>
  );
}
