import { HttpStatus } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception.js';

export class EngineAlreadyRunningException extends AppException {
  static readonly code = 'ENGINE_ALREADY_RUNNING';
  static readonly status = HttpStatus.CONFLICT;
  static readonly example = '다른 engine이 이미 실행 중이에요.';

  constructor() {
    super(
      EngineAlreadyRunningException.code,
      EngineAlreadyRunningException.status,
      EngineAlreadyRunningException.example,
    );
  }
}
