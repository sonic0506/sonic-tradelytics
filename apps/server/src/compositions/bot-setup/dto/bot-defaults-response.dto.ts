import { ApiProperty } from '@nestjs/swagger';

import {
  AMOUNT_TYPES,
  type AmountType,
  HOLDING_ACTIONS,
  type HoldingAction,
} from '@/modules/bot/index.js';

export class AmountSettingDto {
  @ApiProperty({ enum: AMOUNT_TYPES })
  type: AmountType;

  /** 정률이면 비율(0~1], 정액이면 원 */
  value: number;
}

export class TradingHoursDto {
  /** 시작 "HH:mm" */
  start: string;

  /** 종료 "HH:mm" */
  end: string;
}

export class RuleFieldDto {
  /** bot_versions.params의 키 */
  key: string;

  /** 묶음: 종목 필터·진입·청산 */
  @ApiProperty({ enum: ['filter', 'entry', 'exit'] })
  group: 'filter' | 'entry' | 'exit';

  label: string;

  /** number면 숫자, time이면 "HH:mm" */
  @ApiProperty({ enum: ['number', 'time'] })
  kind: 'number' | 'time';

  /** 숫자 뒤에 붙는 단위. 시각이면 null */
  unit: string | null;

  @ApiProperty({ oneOf: [{ type: 'number' }, { type: 'string' }] })
  value: number | string;
}

export class LossStopDto {
  /** 하루 손실 중지 %(양수, 4면 -4%) */
  first: number;

  /** 누적 손실 중지 %(양수) */
  total: number;
}

// GET /v1/bot-defaults (F1 1단계 자동 입력)
export class BotDefaultsResponseDto {
  /** 검증 구간에서 확정하는 투자금 상한 (POL-FUND-11) */
  capAmount: number;

  budget: AmountSettingDto;

  /** 1회 주문 금액(원) */
  orderAmount: number;

  splitCount: number;

  maxPositions: number;

  tradingHours: TradingHoursDto;

  rules: RuleFieldDto[];

  lossStop: LossStopDto;

  stopStreak: number;

  @ApiProperty({ enum: HOLDING_ACTIONS })
  onDailyLimit: HoldingAction;
}
