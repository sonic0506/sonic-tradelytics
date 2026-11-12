import { IsOptional, Matches } from 'class-validator';

export class BotDailyResultQueryDto {
  /** 시작 거래일 (YYYY-MM-DD, 포함). 없으면 처음부터 */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** 끝 거래일 (YYYY-MM-DD, 포함). 없으면 마지막 기록까지 */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class BotDailyResultDto {
  /** 거래일 (YYYY-MM-DD) */
  tradeDate: string;

  /** 그날 실현 손익(수수료·세금 차감) + 장 마감 평가 손익 */
  pnl: number;

  /** 그날 검증 구간(상한 적용)이었는지 */
  verifying: boolean;
}

export class BotDailyResultListDto {
  items: BotDailyResultDto[];
}
