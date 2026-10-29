import { HttpStatus } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception.js';

// 같은 시각에 시작하는 봇들의 정률 합이 100%를 넘어요 (POL-FUND-03)
export class FundRatioExceededException extends AppException {
  static readonly code = 'FUND_RATIO_EXCEEDED';
  static readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  static readonly example = '같이 시작하는 봇들의 정률 합이 100%를 넘어요.';

  constructor() {
    super(
      FundRatioExceededException.code,
      FundRatioExceededException.status,
      FundRatioExceededException.example,
    );
  }
}
