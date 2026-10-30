import { ApiProperty } from '@nestjs/swagger';

import {
  COMMAND_KINDS,
  COMMAND_RESULTS,
  type CommandKind,
  type CommandResult,
} from '../command.constants.js';
import type { Command } from '../entities/command.entity.js';

export class CommandResponseDto {
  /** 명령 id */
  id: string;

  @ApiProperty({ enum: COMMAND_KINDS })
  kind: CommandKind;

  /** 대상 봇 id. kill은 null */
  botId: string | null;

  /** kill에서 전량 청산을 골랐는지 */
  liquidateAll: boolean;

  /** 넣은 시각 */
  requestedAt: Date;

  /** engine이 처리한 시각. 처리 전이면 null (킬 스위치는 1초 안) */
  handledAt: Date | null;

  /** 처리 결과 */
  @ApiProperty({ enum: COMMAND_RESULTS, nullable: true })
  result: CommandResult | null;

  /** 실패 이유 (예: BOT_NOT_RESTING:holding) */
  error: string | null;

  static from(command: Command): CommandResponseDto {
    const dto = new CommandResponseDto();
    dto.id = String(command.id);
    dto.kind = command.kind;
    dto.botId = command.botId === null ? null : String(command.botId);
    dto.liquidateAll = command.liquidateAll;
    dto.requestedAt = command.requestedAt;
    dto.handledAt = command.handledAt;
    dto.result = command.result;
    dto.error = command.error;
    return dto;
  }
}
