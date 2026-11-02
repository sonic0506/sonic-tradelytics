import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

import { HOLDING_ACTIONS, type HoldingAction } from '@/modules/bot/index.js';

import {
  CreateBotBudgetDto,
  CreateBotTradingHoursDto,
} from './create-bot.dto.js';

// PATCH /v1/bots/:id: 판단에 쓰이지 않는 설정만. 투자금은 시작 전(ready·waiting_funds)만.
// 1회 주문 금액·규칙 값은 버전으로 바꿔요(POST /v1/bots/:id/versions)
export class UpdateBotDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  /** 운용 종료일. null이면 무기한 */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  periodEnd?: string | null;

  @ApiPropertyOptional({ enum: HOLDING_ACTIONS })
  @IsOptional()
  @IsIn(HOLDING_ACTIONS)
  onPeriodEnd?: HoldingAction;

  /** 정액 봇 시작 우선순위 (작을수록 먼저) */
  @IsOptional()
  @IsInt()
  startPriority?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBotTradingHoursDto)
  tradingHours?: CreateBotTradingHoursDto;

  /** 시작 전(ready·waiting_funds) 봇만 */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBotBudgetDto)
  budget?: CreateBotBudgetDto;
}

export class UpdatedBotDto {
  id: string;

  /** 저장한 운영 시간 "HH:mm" */
  @ApiProperty({ example: { start: '09:05', end: '15:20' } })
  tradingHours: { start: string; end: string };
}
