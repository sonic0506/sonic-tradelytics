import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNumberString, IsOptional, Matches } from 'class-validator';

import { PageQueryDto } from '@/common/pagination/page-query.dto.js';

import { ORDER_ORIGINS, type OrderOrigin } from '../order.constants.js';

// ?botIds=1,2&origins=bot,manual 처럼 쉼표로 여러 개를 받아요
const splitComma = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',') : value;

export class FilledOrderQueryDto extends PageQueryDto {
  /** 시작 거래일 (YYYY-MM-DD, 포함). 마지막 체결 시각 기준 */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** 끝 거래일 (YYYY-MM-DD, 포함) */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  /** 봇 id (쉼표로 여러 개). 없으면 전체 */
  @ApiPropertyOptional({ type: String, example: '1,2' })
  @IsOptional()
  @Transform(splitComma)
  @IsNumberString({ no_symbols: true }, { each: true })
  botIds?: string[];

  /** 주문 출처 (쉼표로 여러 개). 기본값 bot,protective */
  @ApiPropertyOptional({ type: String, example: 'bot,protective' })
  @IsOptional()
  @Transform(splitComma)
  @IsIn(ORDER_ORIGINS, { each: true })
  origins?: OrderOrigin[];
}
