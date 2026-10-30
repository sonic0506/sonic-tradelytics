import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsPositive,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { AMOUNT_TYPES, type AmountType } from '@/modules/bot/index.js';

import { COMMAND_KINDS, type CommandKind } from '../command.constants.js';

// rebudget의 새 투자금 설정 (POL-FUND-12)
export class CommandBudgetDto {
  /** 정률(ratio)·정액(fixed) */
  @ApiProperty({ enum: AMOUNT_TYPES })
  @IsIn(AMOUNT_TYPES)
  budgetType: AmountType;

  /** 정률이면 운용 자산 대비 비율 (0~1] */
  @ValidateIf((budget: CommandBudgetDto) => budget.budgetType === 'ratio')
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  budgetRatio?: number;

  /** 정액이면 금액(원) */
  @ValidateIf((budget: CommandBudgetDto) => budget.budgetType === 'fixed')
  @IsInt()
  @Min(1)
  budgetAmount?: number;

  /** 1회 주문 금액 방식. 지금 버전과 다르면 engine이 거부해요 */
  @ApiProperty({ enum: AMOUNT_TYPES, required: false })
  @IsOptional()
  @IsIn(AMOUNT_TYPES)
  orderSizeType?: AmountType;

  /** 1회 주문 금액(정률이면 0~1, 정액이면 원) */
  @IsOptional()
  @IsPositive()
  orderSizeValue?: number;
}

export class CreateCommandDto {
  /** 명령 종류 */
  @ApiProperty({ enum: COMMAND_KINDS })
  @IsIn(COMMAND_KINDS)
  kind: CommandKind;

  /** 대상 봇 id. kill이 아니면 필수 */
  @ValidateIf((command: CreateCommandDto) => command.kind !== 'kill')
  @IsNumberString({ no_symbols: true })
  botId?: string;

  /** kill에서 보유 종목도 모두 시장가로 청산할지 */
  @IsOptional()
  @IsBoolean()
  liquidateAll?: boolean;

  /** rebudget의 새 투자금 설정 */
  @ValidateIf((command: CreateCommandDto) => command.kind === 'rebudget')
  @ValidateNested()
  @Type(() => CommandBudgetDto)
  budget?: CommandBudgetDto;
}
