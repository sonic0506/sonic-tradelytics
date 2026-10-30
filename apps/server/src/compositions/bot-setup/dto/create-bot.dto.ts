import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  AMOUNT_TYPES,
  type AmountType,
  BOT_TYPES,
  type BotType,
  HOLDING_ACTIONS,
  type HoldingAction,
  RISK_PROFILES,
  type RiskProfile,
} from '@/modules/bot/index.js';

export class CreateBotBudgetDto {
  @ApiProperty({ enum: AMOUNT_TYPES })
  @IsIn(AMOUNT_TYPES)
  type: AmountType;

  /** 정률이면 비율(0~1], 정액이면 원 */
  @IsNumber()
  @IsPositive()
  value: number;
}

export class CreateBotPeriodDto {
  /** 운용 시작일 YYYY-MM-DD */
  @IsDateString({ strict: true })
  start: string;

  /** 운용 종료일. 무기한이면 null */
  @IsOptional()
  @IsDateString({ strict: true })
  end: string | null;

  /** 종료일 도달 시 보유분 처리 */
  @ApiProperty({ enum: HOLDING_ACTIONS })
  @IsIn(HOLDING_ACTIONS)
  onEnd: HoldingAction;
}

export class CreateBotTradingHoursDto {
  /** 시작 "HH:mm" */
  @IsString()
  start: string;

  /** 종료 "HH:mm" */
  @IsString()
  end: string;
}

export class CreateBotLossStopDto {
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

// POST /v1/bots. stage·status는 서버가 정해요 (FR-BOT-02)
export class CreateBotDto {
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({ enum: BOT_TYPES })
  @IsIn(BOT_TYPES)
  type: BotType;

  @ApiProperty({ enum: RISK_PROFILES })
  @IsIn(RISK_PROFILES)
  riskProfile: RiskProfile;

  @ValidateNested()
  @Type(() => CreateBotBudgetDto)
  budget: CreateBotBudgetDto;

  /** 정액 봇이 같은 시각 봇들 중 돈을 받는 순서. first면 맨 앞, 그 밖에는 맨 뒤 (POL-FUND-14) */
  @ApiPropertyOptional({ enum: ['first', 'last'], nullable: true })
  @IsOptional()
  @IsIn(['first', 'last'])
  startPriority: 'first' | 'last' | null;

  /** 1회 주문 금액(원) */
  @IsInt()
  @IsPositive()
  orderAmount: number;

  @IsInt()
  @Min(1)
  @Max(10)
  splitCount: number;

  @IsInt()
  @Min(1)
  @Max(20)
  maxPositions: number;

  @ValidateNested()
  @Type(() => CreateBotPeriodDto)
  period: CreateBotPeriodDto;

  @ValidateNested()
  @Type(() => CreateBotTradingHoursDto)
  tradingHours: CreateBotTradingHoursDto;

  /** 유형별 규칙 값 (GET /v1/bot-defaults의 rules 키). 시각은 "HH:mm" */
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  params: Record<string, unknown>;

  @ValidateNested()
  @Type(() => CreateBotLossStopDto)
  lossStop: CreateBotLossStopDto;

  @IsInt()
  @Min(1)
  @Max(10)
  stopStreak: number;

  @ApiProperty({ enum: HOLDING_ACTIONS })
  @IsIn(HOLDING_ACTIONS)
  onDailyLimit: HoldingAction;
}

export class CreatedBotDto {
  /** 만든 봇 id */
  id: string;
}
