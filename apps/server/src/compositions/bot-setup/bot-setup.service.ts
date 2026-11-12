import { Injectable } from '@nestjs/common';

import { kstAt } from '@/common/time/kst-date.js';
import {
  type Bot,
  BotBudgetLockedException,
  BotNotFoundException,
  BotService,
  type BotType,
  BotTypeNotSupportedException,
  BudgetRatioExceededException,
  DAY_TRADING_DEFAULTS,
  DAY_TRADING_SETUP,
  isTradingHoursValid,
  type RiskProfile,
  SUPPORTED_BOT_TYPES,
  toTimeOfDay,
  TradingHoursOutOfRangeException,
} from '@/modules/bot/index.js';
import { EngineStatusService } from '@/modules/engine-state/index.js';
import {
  type BotBudget,
  FundQueryService,
  isRatioSumValid,
  toBudget,
  VERIFICATION_CAP,
} from '@/modules/fund/index.js';
import { DEFAULT_LOSS_LIMITS } from '@/modules/risk/index.js';

import type {
  AllocationPreviewDto,
  AllocationPreviewItemDto,
  AllocationPreviewRequestDto,
} from './dto/allocation-preview.dto.js';
import type { BotDefaultsResponseDto } from './dto/bot-defaults-response.dto.js';
import type { CreateBotDto } from './dto/create-bot.dto.js';
import type { UpdateBotDto } from './dto/update-bot.dto.js';

// controller의 @ApiErrors가 쓰도록 다시 내보내요 (composition controller는 feature를 직접 가져오지 않아요)
export {
  BotBudgetLockedException,
  BotNotFoundException,
  BotParamsInvalidException,
  BotTypeNotSupportedException,
  BudgetRatioExceededException,
  TradingHoursOutOfRangeException,
} from '@/modules/bot/index.js';

// "HH:mm:ss" → "HH:mm"
const HH_MM = 5;
// 비율 합을 소수 넷째 자리로 (0.0001 = 0.01%)
const RATIO_DIGITS = 10_000;

const isSupported = (type: BotType): boolean =>
  SUPPORTED_BOT_TYPES.some((supported) => supported === type);

// 봇 만들기 화면 (F1). 기본값은 bot(규칙)·fund(검증 구간 상한)·risk(손실 한도) 값을 모아요
@Injectable()
export class BotSetupService {
  constructor(
    private readonly bots: BotService,
    private readonly funds: FundQueryService,
    private readonly engineStatuses: EngineStatusService,
  ) {}

  // 저장 전 예상 배분 (FR-BOT-05). 같은 시각에 시작하는, 아직 확정 전인 봇들과 함께 계산해요. 저장하지 않아요
  async previewAllocation(
    request: AllocationPreviewRequestDto,
  ): Promise<AllocationPreviewDto> {
    const start = toTimeOfDay(request.tradingStart);
    if (start === null) throw new TradingHoursOutOfRangeException();
    const sameStart = (await this.bots.findStartingAt(start)).filter(
      ({ id }) => id !== request.botId,
    );
    const ids = sameStart.map(({ id }) => id);
    const [allocated, others, [own], engine] = await Promise.all([
      this.funds.viewsOf(ids),
      this.bots.findWithVersions(ids),
      this.bots.findWithVersions(request.botId ? [request.botId] : []),
      this.engineStatuses.find(),
    ]);
    // 이미 확정된 봇은 운용 자산에서 현금 몫으로 빠져요. 확정 전인 봇만 같이 확정돼요
    const waiting = others.filter(({ bot }) => !allocated.has(bot.id));
    const ratios = [
      ...sameStart.flatMap(({ budgetRatio }) =>
        budgetRatio === null ? [] : [budgetRatio],
      ),
      ...(request.budget.type === 'ratio' ? [request.budget.value] : []),
    ];
    const isBlocked = !isRatioSumValid(ratios);
    const target: BotBudget = {
      botId: request.botId ?? 0,
      budget:
        request.budget.type === 'ratio'
          ? { type: 'ratio', ratio: request.budget.value }
          : { type: 'fixed', amount: request.budget.value },
      // 새 봇은 같은 시각 봇들 맨 뒤 (POST /v1/bots 기본값)
      startPriority: own?.bot.startPriority ?? Number.MAX_SAFE_INTEGER,
      isVerifying: (own?.bot.stage ?? 'verifying') === 'verifying',
      fixedOrderSize:
        own?.version?.orderSizeType === 'fixed'
          ? own.version.orderSizeValue
          : null,
    };
    const budgets = [...waiting.map(toBudget), ...(isBlocked ? [] : [target])];
    const orderable =
      engine?.orderableCash == null
        ? null
        : {
            cash: engine.orderableCash,
            at: engine.accountSyncedAt ?? engine.heartbeatAt,
          };
    const preview = await this.funds.previewAllocation(
      budgets,
      orderable,
      request.botId,
    );
    const itemOf = (
      budget: BotBudget,
      name: string | null,
      botId: string | null,
    ): AllocationPreviewItemDto => {
      const outcome = preview.outcomes.find(
        (planned) => planned.botId === budget.botId,
      );
      return {
        botId,
        name,
        budget:
          budget.budget.type === 'ratio'
            ? { type: 'ratio', value: budget.budget.ratio }
            : { type: 'fixed', value: budget.budget.amount },
        amount: outcome?.status === 'allocated' ? outcome.amount : null,
        outcome:
          budget === target && isBlocked
            ? 'blocked'
            : outcome?.status === 'allocated'
              ? 'confirmed'
              : 'pending',
      };
    };
    return {
      basedAt: preview.basedAt,
      capital: preview.capital,
      startAt: kstAt(request.periodStart, start.slice(0, HH_MM)),
      ratioTotal:
        Math.round(ratios.reduce((a, b) => a + b, 0) * RATIO_DIGITS) /
        RATIO_DIGITS,
      items: [
        ...waiting.map((bot) =>
          itemOf(toBudget(bot), bot.bot.name, String(bot.bot.id)),
        ),
        itemOf(
          target,
          own?.bot.name ?? null,
          request.botId ? String(request.botId) : null,
        ),
      ],
    };
  }

  defaults(type: BotType, riskProfile: RiskProfile): BotDefaultsResponseDto {
    if (!isSupported(type)) throw new BotTypeNotSupportedException(type);
    const loss = DEFAULT_LOSS_LIMITS[type][riskProfile];
    return {
      capAmount: VERIFICATION_CAP,
      ...DAY_TRADING_SETUP,
      budget: { ...DAY_TRADING_SETUP.budget },
      tradingHours: { ...DAY_TRADING_SETUP.tradingHours },
      rules: this.bots.ruleFields(DAY_TRADING_DEFAULTS),
      lossStop: { first: loss.lossPct, total: loss.totalLossPct },
    };
  }

  // POST /v1/bots: 유형·운영 시간·규칙 값·정률 합을 검사하고 봇과 첫 버전을 저장해요
  async create(request: CreateBotDto): Promise<Bot> {
    if (!isSupported(request.type))
      throw new BotTypeNotSupportedException(request.type);
    const start = toTimeOfDay(request.tradingHours.start);
    const end = toTimeOfDay(request.tradingHours.end);
    if (start === null || end === null || !isTradingHoursValid(start, end))
      throw new TradingHoursOutOfRangeException();
    const exitAt = request.params.exitAt;
    const params = this.bots.parseParams({
      ...request.params,
      ...(typeof exitAt === 'string' ? { exitAt: toTimeOfDay(exitAt) } : {}),
    });

    const sameStart = await this.bots.findStartingAt(start);
    const isRatio = request.budget.type === 'ratio';
    this.assertRatioSum(sameStart, request.budget, start);
    const priorities = sameStart.map(({ startPriority }) => startPriority);
    const startPriority =
      request.startPriority === 'first'
        ? Math.min(0, ...priorities) - 1
        : Math.max(0, ...priorities) + 1;

    return this.bots.create(
      {
        name: request.name,
        type: request.type,
        riskProfile: request.riskProfile,
        budgetType: request.budget.type,
        budgetRatio: isRatio ? request.budget.value : null,
        budgetAmount: isRatio ? null : Math.floor(request.budget.value),
        startPriority,
        tradingStart: start,
        tradingEnd: end,
        periodStart: request.period.start,
        periodEnd: request.period.end,
        onPeriodEnd: request.period.onEnd,
      },
      {
        params: Object.fromEntries(Object.entries(params)),
        orderSizeType: 'fixed',
        orderSizeValue: request.orderAmount,
        splitCount: request.splitCount,
        maxPositions: request.maxPositions,
        dailyLossPct: request.lossStop.first,
        totalLossPct: request.lossStop.total,
        stopStreak: request.stopStreak,
        onDailyLimit: request.onDailyLimit,
        appliedAt: new Date(),
      },
    );
  }

  // PATCH /v1/bots/:id: 투자금은 시작 전(ready·waiting_funds)만, 운영 시간과 정률 합은 만들 때와 같이 검사해요
  async update(
    id: number,
    request: UpdateBotDto,
  ): Promise<Pick<Bot, 'id' | 'tradingStart' | 'tradingEnd'>> {
    const bot = await this.bots.findById(id);
    if (!bot) throw new BotNotFoundException(id);
    const { budget, tradingHours } = request;
    if (budget && bot.status !== 'ready' && bot.status !== 'waiting_funds')
      throw new BotBudgetLockedException(bot.status);
    const start = tradingHours
      ? toTimeOfDay(tradingHours.start)
      : bot.tradingStart;
    const end = tradingHours ? toTimeOfDay(tradingHours.end) : bot.tradingEnd;
    if (start === null || end === null || !isTradingHoursValid(start, end))
      throw new TradingHoursOutOfRangeException();
    if (budget || tradingHours) {
      const others = (await this.bots.findStartingAt(start)).filter(
        (other) => other.id !== id,
      );
      this.assertRatioSum(
        others,
        budget ?? {
          type: bot.budgetType,
          value: bot.budgetRatio ?? bot.budgetAmount ?? 0,
        },
        start,
      );
    }
    const fields = {
      name: request.name,
      periodEnd: request.periodEnd,
      onPeriodEnd: request.onPeriodEnd,
      startPriority: request.startPriority,
      tradingStart: start,
      tradingEnd: end,
      ...(budget
        ? {
            budgetType: budget.type,
            budgetRatio: budget.type === 'ratio' ? budget.value : null,
            budgetAmount:
              budget.type === 'fixed' ? Math.floor(budget.value) : null,
          }
        : {}),
    };
    await this.bots.update(
      id,
      Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ),
    );
    return { id, tradingStart: start, tradingEnd: end };
  }

  // POL-FUND-03: 같은 시각에 시작하는 정률 봇들의 합이 100% 이하예요
  private assertRatioSum(
    sameStart: { budgetRatio: number | null }[],
    budget: { type: 'ratio' | 'fixed'; value: number },
    start: string,
  ): void {
    if (budget.type !== 'ratio') return;
    const ratios = sameStart.flatMap(({ budgetRatio }) =>
      budgetRatio === null ? [] : [budgetRatio],
    );
    if (!isRatioSumValid([...ratios, budget.value]))
      throw new BudgetRatioExceededException(start.slice(0, HH_MM));
  }
}
