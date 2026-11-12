import { Matches } from 'class-validator';

export class DailyResultQueryDto {
  /** 시작 거래일 (YYYY-MM-DD, 포함) */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;

  /** 끝 거래일 (YYYY-MM-DD, 포함) */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;
}
