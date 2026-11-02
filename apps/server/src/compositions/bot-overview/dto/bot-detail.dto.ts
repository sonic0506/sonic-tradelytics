import { ApiProperty } from '@nestjs/swagger';

import { HOLDING_ACTIONS, type HoldingAction } from '@/modules/bot/index.js';

import { BotListItemDto } from './bot-list-item.dto.js';
import { type BotOverviewDetail, rate } from './bot-overview.dto.js';

const NOT_RESTING_REASONS = ['holding', 'pending_order', 'trading_hours'];

export class LossRoomDto {
  /** 누적 손실 한도까지 남은 여유(원) */
  remaining: number;

  /** 누적 손실 중지 %(양수) */
  limitPercent: number;
}

export class BotFundsDto {
  allocatedAt: Date;

  /** 확정 때 운용 자산 */
  capitalAtAllocation: number;

  /** 사용 중 금액 = 보유 매수 금액 + 미체결 매수 금액 */
  usedAmount: number;

  /** 남은 한도 = 확정 투자금 − 사용 중 금액 */
  remainingBudget: number;

  /** 현금 몫 (POL-FUND-02) */
  cashShare: number;

  /** 확정 이후 실현 손익 */
  realizedPnl: number;

  startPriority: number | null;

  /** 보류 사유. 확정됐으면 null */
  pendingReason: string | null;
}

export class ReleaseCriterionDto {
  key: string;
  value: number | null;
  threshold: number;
  passed: boolean;
}

export class RuleValueDto {
  label: string;

  /** 단위를 붙인 값 (예: "30위", "15:15") */
  display: string;
}

export class DetailRuleFieldDto {
  key: string;

  @ApiProperty({ enum: ['filter', 'entry', 'exit'] })
  group: string;

  label: string;

  @ApiProperty({ enum: ['number', 'time'] })
  kind: string;

  unit: string | null;

  @ApiProperty({ oneOf: [{ type: 'number' }, { type: 'string' }] })
  value: number | string;
}

export class RuleVersionDto {
  version: number;
  appliedAt: Date | null;
  values: RuleValueDto[];
  fields: DetailRuleFieldDto[];
}

export class BotSettingsDto {
  periodEnd: string | null;

  @ApiProperty({ enum: HOLDING_ACTIONS })
  onPeriodEnd: HoldingAction;

  startPriority: number | null;

  /** 1회 주문 금액 (정액이면 원, 정률이면 비율) */
  orderAmount: number;
}

export class HoldingDto {
  /** 종목 이름. 종목 이름을 아직 저장하지 않아 코드예요 */
  symbolName: string;
  quantity: number;
}

// GET /v1/bots/:id: 목록 값 + 상세
export class BotDetailDto extends BotListItemDto {
  /** 투자금을 확정해 돌기 시작한 시각 */
  startedAt: Date | null;

  /** waiting_funds가 된 시각. 아직 기록하지 않아요 */
  waitingSince: Date | null;

  /** 확정 이후 누적 손익 = 실현 + 보유분 평가 */
  cumulativePnl: number;

  cumulativePnlRate: number;

  /** 확정 이후 개장일 수 */
  tradingDays: number;

  lossStop: LossRoomDto | null;

  funds: BotFundsDto | null;

  /** 상한 해제 기준별 현재 값. 기준 계산(4b-2b) 전이라 지금은 빈 목록 */
  releaseCriteria: ReleaseCriterionDto[];

  ruleVersion: RuleVersionDto | null;

  /** 적용을 기다리는 버전 번호 */
  pendingVersion: number | null;

  /** 쉬는 중이 아닌 이유. 쉬는 중이거나 실행 중이 아니면 빈 목록 */
  @ApiProperty({ enum: NOT_RESTING_REASONS, isArray: true })
  notRestingReasons: string[];

  settings: BotSettingsDto;

  holdings: HoldingDto[];

  static fromDetail(detail: BotOverviewDetail): BotDetailDto {
    const dto = Object.assign(new BotDetailDto(), BotListItemDto.from(detail));
    const { bot, version, funds } = detail;
    dto.startedAt = funds?.allocatedAt ?? null;
    dto.waitingSince = null;
    dto.cumulativePnl = detail.cumulativePnl;
    dto.cumulativePnlRate = rate(detail.cumulativePnl, funds?.amount);
    dto.tradingDays = detail.tradingDays;
    dto.lossStop =
      detail.lossRoom === null || !version
        ? null
        : { remaining: detail.lossRoom, limitPercent: version.totalLossPct };
    dto.funds = funds
      ? {
          allocatedAt: funds.allocatedAt,
          capitalAtAllocation: funds.capitalAtAllocation,
          usedAmount: funds.usedAmount,
          remainingBudget: funds.remainingBudget,
          cashShare: funds.cashShare,
          realizedPnl: funds.realizedPnl,
          startPriority: bot.budgetType === 'fixed' ? bot.startPriority : null,
          pendingReason: null,
        }
      : null;
    dto.releaseCriteria = [];
    dto.ruleVersion = version
      ? {
          version: version.version,
          appliedAt: version.appliedAt,
          values: detail.ruleFields.map(({ label, value, unit }) => ({
            label,
            display: `${value}${unit ?? ''}`,
          })),
          fields: detail.ruleFields,
        }
      : null;
    dto.pendingVersion = detail.pendingVersion?.version ?? null;
    dto.notRestingReasons = detail.notRestingReasons;
    dto.settings = {
      periodEnd: bot.periodEnd,
      onPeriodEnd: bot.onPeriodEnd,
      startPriority: bot.budgetType === 'fixed' ? bot.startPriority : null,
      orderAmount: version?.orderSizeValue ?? 0,
    };
    dto.holdings = detail.held
      .filter(({ quantity }) => quantity > 0)
      .map(({ symbol, quantity }) => ({ symbolName: symbol, quantity }));
    return dto;
  }
}
