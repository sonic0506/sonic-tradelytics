import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNumberString, IsOptional, Matches } from 'class-validator';

import { PageQueryDto } from '@/common/pagination/page-query.dto.js';

import { RISK_EVENT_KINDS, type RiskEventKind } from '../risk.constants.js';

// ?botIds=1,2&kinds=daily_stop,feed_stale 처럼 쉼표로 여러 개를 받아요
const splitComma = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',') : value;

export class RiskEventQueryDto extends PageQueryDto {
  /** 봇 id (쉼표로 여러 개) */
  @ApiPropertyOptional({ type: String, example: '1,2' })
  @IsOptional()
  @Transform(splitComma)
  @IsNumberString({ no_symbols: true }, { each: true })
  botIds?: string[];

  /** 이벤트 종류 (쉼표로 여러 개) */
  @ApiPropertyOptional({ type: String, example: 'daily_stop,feed_stale' })
  @IsOptional()
  @Transform(splitComma)
  @IsIn(RISK_EVENT_KINDS, { each: true })
  kinds?: RiskEventKind[];

  /** 시작 거래일 (YYYY-MM-DD, 포함) */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** 끝 거래일 (YYYY-MM-DD, 포함) */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
