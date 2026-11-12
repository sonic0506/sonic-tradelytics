import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  HOLDING_ACTIONS,
  type HoldingAction,
  VERSION_CHANGE_KINDS,
  type VersionChangeKind,
} from '@/modules/bot/index.js';

export class VersionLossStopDto {
  /** 하루 손실 중지 %(양수) */
  @IsNumber()
  @IsPositive()
  @Max(100)
  first: number;

  /** 누적 손실 중지 %(양수) */
  @IsNumber()
  @IsPositive()
  @Max(100)
  total: number;
}

// POST /v1/bots/:id/version-previews·versions. 보내지 않은 값은 지금 버전 그대로예요
export class CreateBotVersionDto {
  /** 바꿀 규칙 값 (GET /v1/bot-defaults의 rules 키). 보내지 않은 키는 지금 값 그대로, 시각은 "HH:mm" */
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  params: Record<string, unknown>;

  /** 1회 주문 금액(원) */
  @IsOptional()
  @IsInt()
  @IsPositive()
  orderAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  splitCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxPositions?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => VersionLossStopDto)
  lossStop?: VersionLossStopDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  stopStreak?: number;

  @ApiPropertyOptional({ enum: HOLDING_ACTIONS })
  @IsOptional()
  @IsIn(HOLDING_ACTIONS)
  onDailyLimit?: HoldingAction;
}

export class RuleChangeDto {
  label: string;
  from: string;
  to: string;
}

export class BotVersionItemDto {
  version: number;

  @ApiProperty({ enum: VERSION_CHANGE_KINDS })
  changeKind: VersionChangeKind;

  /** 바로 앞 버전과 달라진 값. 첫 버전은 빈 목록 */
  changes: RuleChangeDto[];

  createdAt: Date;

  /** 적용 대기면 null (POL-RISK-13) */
  appliedAt: Date | null;
}

// GET /v1/bots/:id/versions
export class BotVersionListDto {
  /** 최신 버전이 앞이에요 */
  items: BotVersionItemDto[];
}

export const APPLY_TIMINGS = ['now', 'when_resting'] as const;
export type ApplyTiming = (typeof APPLY_TIMINGS)[number];

// POST /v1/bots/:id/version-previews: 저장하면 어떻게 되는지 (FR-BOT-11)
export class VersionPreviewDto {
  /** 바뀐 값이 없으면 null */
  @ApiProperty({ enum: ['decision_change', 'risk_only'], nullable: true })
  changeKind: 'decision_change' | 'risk_only' | null;

  /** now 쉬는 중(또는 시작 전)이라 바로 · when_resting 쉬는 중이 된 뒤 */
  @ApiProperty({ enum: APPLY_TIMINGS })
  applyTiming: ApplyTiming;

  /** 적용하면 상한이 풀린 봇이 검증 구간으로 돌아가 투자금을 검증 상한으로 다시 확정하는지 */
  reconfirmsAtCap: boolean;

  changes: RuleChangeDto[];
}

// POST /v1/bots/:id/versions 응답
export class CreatedBotVersionDto {
  version: number;

  @ApiProperty({ enum: VERSION_CHANGE_KINDS })
  changeKind: VersionChangeKind;

  /** 바로 적용했으면 시각, 쉬는 중이 될 때까지 기다리면 null */
  appliedAt: Date | null;
}
