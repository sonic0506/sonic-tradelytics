import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

import { BOT_STAGES, type BotStage } from '@/modules/bot/index.js';

export class BotStatQueryDto {
  /** 시작 거래일 (YYYY-MM-DD, 포함). 없으면 처음부터 */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** 끝 거래일 (YYYY-MM-DD, 포함). 없으면 지금까지 */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class BotStatDto {
  /** 봇 id. 직접 거래 줄이면 null (FR-MAN-05) */
  botId: string | null;

  name: string;

  @ApiProperty({ enum: BOT_STAGES, nullable: true })
  stage: BotStage | null;

  /** 기간 순손익 ÷ 확정 투자금, %. 청산이 없거나 확정 투자금이 없으면 null */
  returnRate: number | null;

  /** 기간에 청산한 거래의 순손익(수수료·세금 차감). 청산이 없으면 null */
  netPnl: number | null;

  /** 순손익 > 0인 청산 수 ÷ 청산 수 (0~1) */
  winRate: number | null;

  /** 평균 순이익 ÷ 평균 순손실(절댓값). 이긴 거래나 진 거래가 없으면 null */
  profitFactor: number | null;

  /** 일별 손익 누적 곡선의 고점 대비 최대 하락, 확정 투자금 대비 %(양수) */
  mdd: number | null;

  /** 진입~청산 평균, 분 */
  avgHoldMinutes: number | null;

  /** 청산한 거래 수 (한 주도 체결되지 않은 진입은 빼요) */
  tradeCount: number;

  /** 수수료 + 세금 합계 */
  cost: number;
}

export class BenchmarkDto {
  kospi: number;
  kosdaq: number;
}

export class BotStatListDto {
  items: BotStatDto[];

  /** 같은 기간 지수 수익률(%). 지수를 저장하기 전이라 지금은 null이에요 (FR-PERF-09) */
  @ApiProperty({ type: BenchmarkDto, nullable: true })
  benchmark: BenchmarkDto | null;
}
