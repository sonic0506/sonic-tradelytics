import { ApiProperty } from '@nestjs/swagger';

import {
  AMOUNT_TYPES,
  type AmountType,
  BOT_STAGES,
  BOT_STATUSES,
  BOT_TYPES,
  type BotStage,
  type BotStatus,
  type BotType,
} from '@/modules/bot/index.js';

export class HomeBudgetSettingDto {
  @ApiProperty({ enum: AMOUNT_TYPES })
  type: AmountType;

  /** 정률이면 비율(0~1], 정액이면 원 */
  value: number;
}

export class HomeAccountDto {
  /** 주문 가능 금액 + 보유 평가금액. engine이 잔고를 아직 쓰지 않으면 null */
  evaluationAmount: number | null;

  /** 주문 가능 금액. engine이 잔고를 아직 쓰지 않으면 null */
  orderableAmount: number | null;

  /** 보유 중인 종목 수 (봇·직접 거래 합쳐 종목마다 한 번) */
  holdingSymbolCount: number;

  /** engine이 계좌를 맞춘 시각. 아직이면 null */
  syncedAt: Date | null;
}

export class HomeTodayPnlDto {
  /** 오늘 연 포지션의 실현 손익 + 보유분 평가 손익. 직접 거래와 검증 구간 봇 포함 (FR-PERF-10) */
  amount: number;

  /** amount ÷ 평가금액, %. 평가금액을 모르면 null */
  rate: number | null;
}

export class HomeBotCountsDto {
  running: number;
  paused: number;
  waitingFunds: number;
  stopped: number;
}

// 홈 봇 카드 한 줄 (stopped가 아닌 봇)
export class HomeBotDto {
  id: string;
  name: string;

  @ApiProperty({ enum: BOT_TYPES })
  type: BotType;

  @ApiProperty({ enum: BOT_STATUSES })
  status: BotStatus;

  @ApiProperty({ enum: BOT_STAGES })
  stage: BotStage;

  /** 지금 적용된 규칙 값 버전 번호. 없으면 0 */
  version: number;

  /** 그 봇의 오늘 손익 (위 todayPnl과 같은 계산) */
  todayPnl: number;

  /** 그 봇의 오늘 체결 주문 수 */
  todayFills: number;

  /** 최근 30거래일 청산 승률 (0~1). 청산이 없으면 null */
  winRate30d: number | null;

  /** 확정 투자금. 확정 전(waiting_funds·ready)이면 null */
  budget: number | null;

  /** 투자금 설정값 */
  budgetSetting: HomeBudgetSettingDto;

  /** 오늘을 뺀 최근 7거래일 일별 손익(실현 + 평가), 오래된 순. 기록이 없는 날은 빠져요 */
  last7Days: number[];
}

export class HomeFillsDto {
  /** 오늘 체결된 주문 수 (직접 거래 포함) */
  total: number;
  buy: number;
  sell: number;
}

// GET /v1/home (api.md 홈)
export class HomeDto {
  account: HomeAccountDto;
  todayPnl: HomeTodayPnlDto;
  botCounts: HomeBotCountsDto;
  bots: HomeBotDto[];
  fills: HomeFillsDto;
}
