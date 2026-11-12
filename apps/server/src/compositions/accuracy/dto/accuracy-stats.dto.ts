import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumberString, IsOptional, Matches } from 'class-validator';

// ?botIds=1,2 처럼 쉼표로 여러 개를 받아요
const splitComma = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',') : value;

// GET /v1/accuracy-stats 필터. 기간은 판단 시각(거래일) 기준이에요
export class AccuracyStatsQueryDto {
  /** 시작 거래일 (YYYY-MM-DD, 포함) */
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
}

export class BotAccuracyDto {
  botId: string;
  name: string;
  scoredCount: number;
  /** 방향 적중률 (0~1) */
  directionHitRate: number;
  /** 목표 도달률 평균 (0~1) */
  targetReachRate: number;
  /** 평균 예측 오차, % */
  avgErrorPct: number;
}

export class AccuracySummaryDto {
  /** 채점된 예측 수 (진입·재평가 판단) */
  scoredCount: number;
  directionHitRate: number;
  targetReachRate: number;
  bots: BotAccuracyDto[];
}

export class ScoreBucketDto {
  min: number;
  max: number;
  /** 그 구간 진입 판단으로 청산한 수 (한 주도 체결되지 않은 진입은 빼요) */
  closedCount: number;
  /** 순손익 > 0인 청산 비율 (0~1) */
  winRate: number;
}

// GET /v1/accuracy-stats (FR-RAT-05, 06). Should 섹션(conditions·skipped·reeval)은 구현 전이라 응답에 없어요
export class AccuracyStatsDto {
  summary: AccuracySummaryDto;

  /** 신뢰 점수 구간별 청산 수와 승률, 높은 구간부터 */
  scoreBuckets: ScoreBucketDto[];
}
