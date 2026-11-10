import { ApiProperty } from '@nestjs/swagger';

import { PageMetaDto } from '@/common/pagination/page.dto.js';
import {
  AMOUNT_TYPES,
  type AmountType,
  BOT_STAGES,
  BOT_STATUSES,
  BOT_TYPES,
  type BotStage,
  type BotStatus,
  type BotType,
  RISK_PROFILES,
  type RiskProfile,
} from '@/modules/bot/index.js';
import { VERIFICATION_CAP } from '@/modules/fund/index.js';

import { type BotOverview, rate } from './bot-overview.dto.js';

const HH_MM = 5;
const ACTIVITIES = ['trading', 'off_hours', 'limit_reached', 'market_closed'];

export class StatusReasonDto {
  /** bots.status_reason 그대로예요 (예: daily_stop, total_stop, streak_pause, rate_cap, kill_switch, bot_error, insufficient_funds, pause, liquidate) */
  code: string;

  /** 연속 손절로 멈췄으면 그 횟수 */
  count: number | null;

  /** 모자란 금액. 아직 계산하지 않아요 */
  amount: number | null;
}

export class BudgetSettingDto {
  @ApiProperty({ enum: AMOUNT_TYPES })
  type: AmountType;

  /** 정률이면 비율(0~1], 정액이면 원 */
  value: number;
}

export class HoursDto {
  /** "HH:mm" */
  start: string;

  /** "HH:mm" */
  end: string;
}

export class ProgressDto {
  passed: number;
  total: number;
}

export class ShortfallDto {
  required: number;
  available: number;
}

// GET /v1/bots 한 줄
export class BotListItemDto {
  id: string;
  name: string;

  @ApiProperty({ enum: BOT_TYPES })
  type: BotType;

  @ApiProperty({ enum: RISK_PROFILES })
  riskProfile: RiskProfile;

  /** 지금 적용된 규칙 값 버전 번호. 없으면 0 */
  version: number;

  @ApiProperty({ enum: BOT_STATUSES })
  status: BotStatus;

  statusReason: StatusReasonDto | null;

  @ApiProperty({ enum: BOT_STAGES })
  stage: BotStage;

  /** 상한 해제 시각. 아직 기록하지 않아요 */
  releasedAt: Date | null;

  /** 종료 시각. 아직 기록하지 않아요 */
  endedAt: Date | null;

  /** 검증 구간이면 상한 해제 기준 통과 수. 기준 계산(4b-2b) 전이라 지금은 null */
  releaseProgress: ProgressDto | null;

  /** 검증 구간 투자금 상한 (POL-FUND-11) */
  capAmount: number;

  /** 확정 투자금. 확정 전이면 null */
  budget: number | null;

  budgetSetting: BudgetSettingDto;

  /** waiting_funds면 확정에 필요한 금액과 쓸 수 있는 운용 자산. 배분 미리보기(4b-2b) 전이라 지금은 null */
  fundShortfall: ShortfallDto | null;

  /** 오늘 손익 = 오늘 연 포지션의 실현 손익 + 보유분 평가 손익(최근가를 아는 종목) */
  todayPnl: number;

  /** 오늘 손익 ÷ 확정 투자금, % */
  todayPnlRate: number;

  /** 오늘 운영 상황. 실행 중·일시정지 봇만 있어요 */
  @ApiProperty({ enum: ACTIVITIES, nullable: true })
  activity: string | null;

  /** 쉬는 중 (보유·미체결 없음, 운영 시간 밖) */
  resting: boolean;

  /** 다음 운영 시작 시각 */
  nextRunAt: Date | null;

  tradingHours: HoursDto;

  static from(overview: BotOverview): BotListItemDto {
    const { bot, version, funds } = overview;
    const dto = new BotListItemDto();
    dto.id = String(bot.id);
    dto.name = bot.name;
    dto.type = bot.type;
    dto.riskProfile = bot.riskProfile;
    dto.version = version?.version ?? 0;
    dto.status = bot.status;
    dto.statusReason = bot.statusReason
      ? {
          code: bot.statusReason,
          count:
            bot.statusReason === 'streak_pause'
              ? (version?.stopStreak ?? null)
              : null,
          amount: null,
        }
      : null;
    dto.stage = bot.stage;
    dto.releasedAt = null;
    dto.endedAt = null;
    dto.releaseProgress =
      overview.releaseCriteria.length === 0
        ? null
        : {
            passed: overview.releaseCriteria.filter(({ passed }) => passed)
              .length,
            total: overview.releaseCriteria.length,
          };
    dto.capAmount = VERIFICATION_CAP;
    dto.budget = funds?.amount ?? null;
    dto.budgetSetting = {
      type: bot.budgetType,
      value:
        bot.budgetType === 'ratio'
          ? (bot.budgetRatio ?? 0)
          : (bot.budgetAmount ?? 0),
    };
    dto.fundShortfall = null;
    dto.todayPnl = overview.todayPnl;
    dto.todayPnlRate = rate(overview.todayPnl, funds?.amount);
    dto.activity = overview.activity;
    dto.resting = overview.resting;
    dto.nextRunAt = overview.nextRunAt;
    dto.tradingHours = {
      start: bot.tradingStart.slice(0, HH_MM),
      end: bot.tradingEnd.slice(0, HH_MM),
    };
    return dto;
  }
}

export class BotPageDto {
  items: BotListItemDto[];
  meta: PageMetaDto;
}
