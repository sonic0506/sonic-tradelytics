import { ApiProperty } from '@nestjs/swagger';

import { PageMetaDto } from '@/common/pagination/page.dto.js';

import type { RiskEvent } from '../entities/risk-event.entity.js';
import { RISK_EVENT_KINDS, type RiskEventKind } from '../risk.constants.js';

export class RiskEventResponseDto {
  id: string;

  /** 봇 이벤트면 봇 id, 계좌·engine 전체 이벤트면 null */
  botId: string | null;

  botName: string | null;

  @ApiProperty({ enum: RISK_EVENT_KINDS })
  kind: RiskEventKind;

  occurredAt: Date;

  /** 숫자·코드로 된 상세 (예: 손실 한도의 amount·dailyPnl). 화면 문구는 web이 kind로 만들어요 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  detail: Record<string, unknown>;

  /** 텔레그램으로 알린 시각. 아직이면 null (POL-RISK-12) */
  notifiedAt: Date | null;

  static from(event: RiskEvent): RiskEventResponseDto {
    const dto = new RiskEventResponseDto();
    dto.id = String(event.id);
    dto.botId = event.botId === null ? null : String(event.botId);
    dto.botName = event.bot?.name ?? null;
    dto.kind = event.kind;
    dto.occurredAt = event.occurredAt;
    dto.detail = event.detail;
    dto.notifiedAt = event.notifiedAt;
    return dto;
  }
}

export class RiskEventPageDto {
  items: RiskEventResponseDto[];
  meta: PageMetaDto;
}
