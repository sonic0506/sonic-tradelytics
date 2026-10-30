import { HttpStatus } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception.js';

// engine이 한 번도 켜지지 않아 engine_statuses가 비어 있어요
export class EngineStatusNotFoundException extends AppException {
  static readonly code = 'ENGINE_STATUS_NOT_FOUND';
  static readonly status = HttpStatus.NOT_FOUND;
  static readonly example = 'engine이 아직 상태를 쓰지 않았어요.';

  constructor() {
    super(
      EngineStatusNotFoundException.code,
      EngineStatusNotFoundException.status,
      EngineStatusNotFoundException.example,
    );
  }
}
