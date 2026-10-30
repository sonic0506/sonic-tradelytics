import { Injectable } from '@nestjs/common';

import {
  type Bot,
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
import { isRatioSumValid, VERIFICATION_CAP } from '@/modules/fund/index.js';
import { DEFAULT_LOSS_LIMITS } from '@/modules/risk/index.js';

import type { BotDefaultsResponseDto } from './dto/bot-defaults-response.dto.js';
import type { CreateBotDto } from './dto/create-bot.dto.js';

// controller의 @ApiErrors가 쓰도록 다시 내보내요 (composition controller는 feature를 직접 가져오지 않아요)
export {
  BotParamsInvalidException,
  BotTypeNotSupportedException,
  BudgetRatioExceededException,
  TradingHoursOutOfRangeException,
} from '@/modules/bot/index.js';

const isSupported = (type: BotType): boolean =>
  SUPPORTED_BOT_TYPES.some((supported) => supported === type);

// 봇 만들기 화면 (F1). 기본값은 bot(규칙)·fund(검증 구간 상한)·risk(손실 한도) 값을 모아요
@Injectable()
export class BotSetupService {
  constructor(private readonly bots: BotService) {}

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
    const ratios = sameStart.flatMap(({ budgetRatio }) =>
      budgetRatio === null ? [] : [budgetRatio],
    );
    if (isRatio && !isRatioSumValid([...ratios, request.budget.value]))
      throw new BudgetRatioExceededException(request.tradingHours.start);
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
}
