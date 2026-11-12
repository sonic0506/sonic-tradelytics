import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

import { AMOUNT_TYPES, type AmountType } from '@/modules/bot/index.js';

import { CreateBotBudgetDto } from './create-bot.dto.js';

// POST /v1/allocation-previews: 만들려는(또는 투자금을 다시 정하려는) 봇의 투자금과 시작 시각 (FR-BOT-05)
export class AllocationPreviewRequestDto {
  @ValidateNested()
  @Type(() => CreateBotBudgetDto)
  budget: CreateBotBudgetDto;

  /** 운용 시작일 (YYYY-MM-DD) */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart: string;

  /** 운영 시작 시각 "HH:mm". 같은 시각에 시작하는 봇들과 함께 계산해요 */
  @IsString()
  tradingStart: string;

  /** 투자금 다시 정하기(POL-FUND-12)면 그 봇 id. 그 봇의 지금 투자금은 반환한 것으로 봐요 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  botId?: number;
}

export class PreviewBudgetDto {
  @ApiProperty({ enum: AMOUNT_TYPES })
  type: AmountType;

  /** 정률이면 비율(0~1], 정액이면 원 */
  value: number;
}

export const PREVIEW_OUTCOMES = ['confirmed', 'pending', 'blocked'] as const;

export class AllocationPreviewItemDto {
  /** null이면 지금 만들려는 봇 */
  botId: string | null;

  /** 지금 만들려는 봇이면 null */
  name: string | null;

  budget: PreviewBudgetDto;

  /** 확정 예정 금액. 보류·저장 불가면 null */
  amount: number | null;

  /** confirmed 확정 예정 · pending 보류 예정 · blocked 저장 불가(정률 합 100% 초과) */
  @ApiProperty({ enum: PREVIEW_OUTCOMES })
  outcome: (typeof PREVIEW_OUTCOMES)[number];
}

export class AllocationPreviewDto {
  /** 운용 자산을 읽은 시각. 아직 모르면 null */
  basedAt: Date | null;

  /** 그때 운용 자산 = 주문 가능 금액 − 실행 중 봇의 현금 몫. 아직 모르면 null */
  capital: number | null;

  /** 함께 시작하는 시각 */
  startAt: Date;

  /** 같은 시각 정률 봇 비율의 합 (1을 넘을 수 있어요) */
  ratioTotal: number;

  items: AllocationPreviewItemDto[];
}
