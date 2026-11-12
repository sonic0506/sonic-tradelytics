import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

import { PageQueryDto } from '@/common/pagination/page-query.dto.js';
import {
  EXIT_REASONS,
  type ExitReason,
  POSITION_RESULTS,
  POSITION_VIEWS,
  type PositionResult,
  type PositionView,
} from '@/modules/position/index.js';

// ?botIds=1,manual 처럼 쉼표로 여러 개를 받아요
const splitComma = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',') : value;

// GET /v1/positions, GET /v1/position-summaries 필터 (FR-PERF-05)
export class PositionHistoryQueryDto extends PageQueryDto {
  /** 시작 진입일 (YYYY-MM-DD, 포함) */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** 끝 진입일 (YYYY-MM-DD, 포함) */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  /** 봇 id (쉼표로 여러 개). manual을 넣으면 직접 거래 포함. 없으면 전체 */
  @ApiPropertyOptional({ type: String, example: '1,manual' })
  @IsOptional()
  @Transform(splitComma)
  @Matches(/^(\d+|manual)$/, { each: true })
  botIds?: string[];

  /** 종목 코드 */
  @IsOptional()
  @IsString()
  symbol?: string;

  /** 실현 손익 기준 이익·손실 */
  @ApiPropertyOptional({ enum: POSITION_RESULTS })
  @IsOptional()
  @IsIn(POSITION_RESULTS)
  result?: PositionResult;

  /** 화면 상태. 정하지 않으면 보유 중을 첫 페이지 맨 위에 모두 넣어요 */
  @ApiPropertyOptional({ enum: POSITION_VIEWS })
  @IsOptional()
  @IsIn(POSITION_VIEWS)
  status?: PositionView;

  /** 청산 사유 (쉼표로 여러 개) */
  @ApiPropertyOptional({ type: String, example: 'take_profit,stop_loss' })
  @IsOptional()
  @Transform(splitComma)
  @IsIn(EXIT_REASONS, { each: true })
  exitReasons?: ExitReason[];
}
