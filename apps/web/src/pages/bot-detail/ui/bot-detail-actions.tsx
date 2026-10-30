'use client';

import {
  Button,
  buttonVariants,
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  useToast,
} from '@xonic0506/sonic-ui';
import { Ellipsis } from 'lucide-react';
import NextLink from 'next/link';
import { useState } from 'react';

import type { BotDetailView } from '@/entities/bot';
import {
  LiquidateBotDialog,
  useBotCommandMutation,
} from '@/features/bot/control-bot';

// sonic-ui 0.6.2 buttonVariants는 border-transparent가 남아 secondary 테두리가 사라져요. border-default로 덮어써요.
const SECONDARY_LINK = `${buttonVariants({ variant: 'secondary' })} border-default`;

// 머리 오른쪽 동작: 일시정지·재개, 설정, 더 보기(전량 청산)
export function BotDetailActions({ bot }: { bot: BotDetailView }) {
  const [isLiquidateOpen, setIsLiquidateOpen] = useState(false);
  const toast = useToast();
  const command = useBotCommandMutation();
  const isTrading = bot.status === 'running' || bot.status === 'paused';
  const holdingsText =
    bot.holdings.length > 0
      ? `${bot.holdings.map((holding) => `${holding.symbolName} ${holding.quantity}주`).join(', ')}를 지금 시장가로 팔아요.`
      : undefined;

  const handleToggleClick = () => {
    const kind = bot.status === 'running' ? 'pause' : 'resume';
    command.mutate(
      { botId: bot.id, kind },
      {
        onSuccess: () =>
          toast.add({
            title: `${bot.name} 봇을 ${kind === 'pause' ? '일시정지했어요' : '다시 시작했어요'}`,
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

  return (
    <div className="flex gap-2">
      {isTrading && (
        <Button
          variant="secondary"
          loading={command.isPending}
          onClick={handleToggleClick}
        >
          {bot.status === 'running' ? '일시정지' : '재개'}
        </Button>
      )}
      {bot.status !== 'stopped' && (
        <NextLink href={`/bots/${bot.id}/settings`} className={SECONDARY_LINK}>
          설정
        </NextLink>
      )}
      {isTrading && (
        <>
          <Menu>
            <MenuTrigger
              render={
                <Button
                  size="icon-md"
                  variant="secondary"
                  aria-label="더 보기"
                />
              }
            >
              <Ellipsis />
            </MenuTrigger>
            <MenuPopup>
              <MenuItem
                tone="danger"
                disabled={bot.holdings.length === 0}
                onClick={() => setIsLiquidateOpen(true)}
              >
                전량 청산
              </MenuItem>
            </MenuPopup>
          </Menu>
          <LiquidateBotDialog
            botId={bot.id}
            botName={bot.name}
            {...(holdingsText ? { holdingsText } : {})}
            open={isLiquidateOpen}
            onOpenChange={setIsLiquidateOpen}
          />
        </>
      )}
    </div>
  );
}
