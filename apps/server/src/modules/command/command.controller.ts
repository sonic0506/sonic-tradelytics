import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '@/common/exceptions/api-errors.js';

import {
  BotNotFoundException,
  CommandNotAllowedException,
  CommandNotFoundException,
} from './command.exception.js';
import { CommandRequestService } from './command-request.service.js';
import { CommandResponseDto } from './dto/command-response.dto.js';
import { CreateCommandDto } from './dto/create-command.dto.js';

@ApiTags('commands')
@Controller('commands')
export class CommandController {
  constructor(private readonly commands: CommandRequestService) {}

  /** 봇 정지·재개·청산, 킬 스위치, 투자금 다시 정하기를 engine에 보내요. 결과는 GET으로 확인해요 */
  @ApiErrors(BotNotFoundException, CommandNotAllowedException)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateCommandDto): Promise<CommandResponseDto> {
    return CommandResponseDto.from(await this.commands.create(body));
  }

  /** 명령 처리 결과 (web이 0.5초 간격으로 확인해요) */
  @ApiErrors(CommandNotFoundException)
  @Get(':id')
  async find(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CommandResponseDto> {
    return CommandResponseDto.from(await this.commands.find(id));
  }
}
