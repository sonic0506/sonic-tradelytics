import type {
  Bot,
  BotActivity,
  BotService,
  BotVersion,
  NotRestingReason,
  ReleaseCriterion,
} from '@/modules/bot/index.js';
import type { BotFundsView } from '@/modules/fund/index.js';
import type { Position } from '@/modules/position/index.js';

const PERCENT = 100;

// 봇 하나의 화면용 값을 모은 것. DTO가 이 값으로 응답을 만들어요
export interface BotOverview {
  bot: Bot;
  version: BotVersion | null;
  pendingVersion: BotVersion | null;
  // 확정 전이면 null
  funds: BotFundsView | null;
  held: Position[];
  todayPnl: number;
  // 보유분 평가 손익 (최근가를 아는 종목만)
  unrealizedPnl: number;
  activity: BotActivity | null;
  notRestingReasons: NotRestingReason[];
  resting: boolean;
  nextRunAt: Date | null;
  // 검증 구간이면 상한 해제 기준, 아니면 빈 목록
  releaseCriteria: ReleaseCriterion[];
}

export interface BotOverviewDetail extends BotOverview {
  // 확정 이후 누적 손익 = 실현 + 보유분 평가
  cumulativePnl: number;
  tradingDays: number;
  // 누적 손실 한도까지 남은 여유. 확정 전이면 null
  lossRoom: number | null;
  // 지금 버전의 규칙 값 칸과 값
  ruleFields: ReturnType<BotService['ruleFields']>;
}

export const rate = (pnl: number, amount: number | undefined): number =>
  amount ? (pnl / amount) * PERCENT : 0;
