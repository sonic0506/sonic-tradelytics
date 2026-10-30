import { HttpStatus } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception.js';

export { BotNotFoundException } from '@/modules/bot/index.js';

export class CommandNotFoundException extends AppException {
  static readonly code = 'COMMAND_NOT_FOUND';
  static readonly status = HttpStatus.NOT_FOUND;
  static readonly example = '명령 1을(를) 찾을 수 없어요.';

  constructor(id: number) {
    super(
      CommandNotFoundException.code,
      CommandNotFoundException.status,
      `명령 ${id}을(를) 찾을 수 없어요.`,
    );
  }
}

// 지금 봇 상태에서 받을 수 없는 명령 (docs/architecture/api.md POST /v1/commands)
export class CommandNotAllowedException extends AppException {
  static readonly code = 'COMMAND_NOT_ALLOWED';
  static readonly status = HttpStatus.CONFLICT;
  static readonly example = 'stopped 봇에는 pause 명령을 보낼 수 없어요.';

  constructor(kind: string, botState: string) {
    super(
      CommandNotAllowedException.code,
      CommandNotAllowedException.status,
      `${botState} 봇에는 ${kind} 명령을 보낼 수 없어요.`,
    );
  }
}
