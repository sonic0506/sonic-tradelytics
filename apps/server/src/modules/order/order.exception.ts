import { HttpStatus } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception.js';

// PaperBroker는 fee_schedules의 수수료·세금률로 체결 비용을 계산해요 (ADR-0005)
export class FeeScheduleMissingException extends AppException {
  static readonly code = 'FEE_SCHEDULE_MISSING';
  static readonly status = HttpStatus.INTERNAL_SERVER_ERROR;
  static readonly example =
    '2026-10-30에 적용할 fee_schedules 수수료율이 없어요.';

  constructor(date: string) {
    super(
      FeeScheduleMissingException.code,
      FeeScheduleMissingException.status,
      `${date}에 적용할 fee_schedules 수수료율이 없어요.`,
    );
  }
}
