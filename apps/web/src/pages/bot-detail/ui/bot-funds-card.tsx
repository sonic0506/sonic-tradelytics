import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@xonic0506/sonic-ui';

import type { BotDetailView } from '@/entities/bot';
import {
  formatDateTime,
  formatRatio,
  formatSignedWon,
  formatWon,
} from '@/shared/lib';
import { PnlText } from '@/shared/ui';

import { Stat } from './stat';

const DASH = '−';

// 자금 (fund-allocation.md "봇 화면에 표시할 자금 정보")
export function BotFundsCard({ bot }: { bot: BotDetailView }) {
  const { funds } = bot;
  const setting = bot.budgetSetting;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>자금</CardTitle>
        <CardDescription>
          {funds
            ? `${formatDateTime(funds.allocatedAt)} 운용 자산 ${formatWon(funds.capitalAtAllocation)} 기준으로 정했어요.`
            : '투자금이 확정되면 보여요.'}
        </CardDescription>
      </CardHeader>
      <CardBody>
        <dl className="m-0 grid grid-cols-3 gap-x-4 gap-y-5 max-sm:grid-cols-2">
          <Stat label="확정 투자금">
            {bot.budget === null ? DASH : formatWon(bot.budget)}
          </Stat>
          <Stat label="사용 중 금액">
            {funds ? formatWon(funds.usedAmount) : DASH}
          </Stat>
          <Stat label="남은 한도">
            {funds ? formatWon(funds.remainingBudget) : DASH}
          </Stat>
          <Stat label="현금 몫">
            {funds ? formatWon(funds.cashShare) : DASH}
          </Stat>
          <Stat label="실현 손익">
            {funds ? (
              <PnlText value={funds.realizedPnl}>
                {formatSignedWon(funds.realizedPnl)}
              </PnlText>
            ) : (
              DASH
            )}
          </Stat>
          <Stat
            label={`설정 방식 · ${setting.type === 'fixed' ? '정액' : '정률'}`}
          >
            {setting.type === 'fixed'
              ? formatWon(setting.value)
              : formatRatio(setting.value)}
          </Stat>
          <Stat label="시작 우선순위">{funds?.startPriority ?? DASH}</Stat>
          <Stat label="보류 상태">{funds?.pendingReason ?? '–'}</Stat>
          {bot.stage === 'verifying' && (
            <Stat label="상한 (검증 중)">{formatWon(bot.capAmount)}</Stat>
          )}
        </dl>
      </CardBody>
    </Card>
  );
}
