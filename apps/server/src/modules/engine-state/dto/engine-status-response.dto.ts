import { ApiProperty } from '@nestjs/swagger';

import type { MarketCalendar } from '@/modules/market-data/index.js';

import {
  ENGINE_STATES,
  type EngineStateValue,
} from '../engine-state.constants.js';
import type { EngineStatus } from '../entities/engine-status.entity.js';

export class MarketOpenDto {
  /** 오늘 정규장이 열리는 날인지. engine이 오늘 일정을 아직 받지 않았으면 false */
  isTradingDay: boolean;

  /** 정규장 시작 시각 */
  openAt: Date | null;

  /** 정규장 끝 시각 */
  closeAt: Date | null;
}

export class EngineStatusResponseDto {
  /** engine 상태. halted는 전체 정지(킬 스위치·토큰·기록 실패) */
  @ApiProperty({ enum: ENGINE_STATES })
  state: EngineStateValue;

  /** 전체 정지 사유 코드 */
  haltReasons: string[];

  /** engine 마지막 기록 시각. 30초 넘게 오래되면 "엔진 응답 없음"이에요 */
  heartbeatAt: Date;

  /** 시세가 끊긴 종목 (feed_stale) */
  staleSymbols: string[];

  /** 오늘 정규장 */
  marketOpen: MarketOpenDto;

  static from(
    status: EngineStatus,
    today: MarketCalendar | null,
  ): EngineStatusResponseDto {
    const dto = new EngineStatusResponseDto();
    dto.state = status.state;
    dto.haltReasons = status.haltReasons;
    dto.heartbeatAt = status.heartbeatAt;
    dto.staleSymbols = status.staleSymbols;
    dto.marketOpen = {
      isTradingDay: today?.isOpen ?? false,
      openAt: today?.regularOpenAt ?? null,
      closeAt: today?.regularCloseAt ?? null,
    };
    return dto;
  }
}
