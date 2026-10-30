import { HttpStatus } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception.js';

export class BotNotFoundException extends AppException {
  static readonly code = 'BOT_NOT_FOUND';
  static readonly status = HttpStatus.NOT_FOUND;
  static readonly example = '봇 1을(를) 찾을 수 없어요.';

  constructor(id: number) {
    super(
      BotNotFoundException.code,
      BotNotFoundException.status,
      `봇 ${id}을(를) 찾을 수 없어요.`,
    );
  }
}
