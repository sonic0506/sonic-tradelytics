import { HttpStatus } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception.js';

export class PositionNotFoundException extends AppException {
  static readonly code = 'POSITION_NOT_FOUND';
  static readonly status = HttpStatus.NOT_FOUND;
  static readonly example = 'position 1을(를) 찾을 수 없어요.';

  constructor(id: number) {
    super(
      PositionNotFoundException.code,
      PositionNotFoundException.status,
      `position ${id}을(를) 찾을 수 없어요.`,
    );
  }
}
