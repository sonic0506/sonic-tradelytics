import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

import { kstDate } from '@/common/time/kst-date.js';

import {
  type BotStatus,
  DAY_TRADING_DEFAULTS,
  DAY_TRADING_FIELDS,
  dayTradingParamsSchema,
  type RuleFieldMeta,
} from './bot.constants.js';
import { BotParamsInvalidException } from './bot.exception.js';
import { BotRepository } from './bot.repository.js';
import type { DayTradingParams } from './day-trading.rule.js';
import type { Bot } from './entities/bot.entity.js';
import type { BotVersion } from './entities/bot-version.entity.js';

// 봇 설정과 지금 적용된 버전(1회 주문 금액 등). 적용된 버전이 없으면 null
export interface BotWithVersion {
  bot: Bot;
  version: BotVersion | null;
}

// "HH:mm:ss" → "HH:mm"
const HH_MM = 5;

// 봇 상태 변경은 engine만 해요 (docs/architecture/engine.md 모듈 배치). 설정 저장은 api 쪽에서 만들어요.
@Injectable()
export class BotService {
  constructor(private readonly bots: BotRepository) {}

  async findWithVersions(ids: number[]): Promise<BotWithVersion[]> {
    if (ids.length === 0) return [];
    const [bots, versions] = await Promise.all([
      this.bots.findByIds(ids),
      this.bots.findAppliedVersions(ids),
    ]);
    // 버전은 봇마다 최신이 앞이라 처음 만난 것이 지금 버전이에요
    const current = new Map<number, BotVersion>();
    for (const version of versions)
      if (!current.has(version.botId)) current.set(version.botId, version);
    return bots.map((bot) => ({ bot, version: current.get(bot.id) ?? null }));
  }

  updateBudget(
    id: number,
    budget: Pick<Bot, 'budgetType' | 'budgetRatio' | 'budgetAmount'>,
  ): Promise<void> {
    return this.bots.updateBudget(id, budget);
  }

  // 저장된 규칙 값(bot_versions.params)에 기본값을 채워요. 모양이 틀리면 VALIDATION_FAILED예요
  parseParams(raw: unknown): DayTradingParams {
    const parsed = dayTradingParamsSchema.safeParse(raw);
    if (!parsed.success)
      throw new BotParamsInvalidException(
        parsed.error.issues.map(({ path, message }) => ({
          field: ['params', ...path.map(String)].join('.'),
          messages: [message],
        })),
      );
    return { ...DAY_TRADING_DEFAULTS, ...parsed.data };
  }

  // 화면에 보여 줄 규칙 값 칸과 값. 시각은 "HH:mm"으로 보여 줘요
  ruleFields(
    params: DayTradingParams,
  ): (RuleFieldMeta & { value: number | string })[] {
    return DAY_TRADING_FIELDS.map((field) => {
      const value = params[field.key];
      return {
        ...field,
        value: typeof value === 'string' ? value.slice(0, HH_MM) : value,
      };
    });
  }

  findOptions(): Promise<Pick<Bot, 'id' | 'name'>[]> {
    return this.bots.findAllNames();
  }

  findStartingAt(
    tradingStart: string,
  ): ReturnType<BotRepository['findStartingAt']> {
    return this.bots.findStartingAt(tradingStart);
  }

  // 봇과 첫 버전을 한 트랜잭션으로 저장해요. 검증 중·시작 전(ready)으로 시작해요 (FR-BOT-02)
  @Transactional()
  create(
    bot: Omit<
      Bot,
      'id' | 'stage' | 'status' | 'statusReason' | 'createdAt' | 'updatedAt'
    >,
    version: Parameters<BotRepository['createWithVersion']>[1],
  ): Promise<Bot> {
    return this.bots.createWithVersion(
      { ...bot, stage: 'verifying', status: 'ready', statusReason: null },
      version,
    );
  }

  findById(id: number): Promise<Bot | null> {
    return this.bots.findById(id);
  }

  // 실행 중·일시정지 봇과 지금 버전 (BotRunner가 주기마다 다시 읽어요). 일시정지 봇은 청산만 해요
  async findTrading(): Promise<BotWithVersion[]> {
    const running = await this.bots.findByStatuses(['running', 'paused']);
    return this.findWithVersions(running.map(({ id }) => id));
  }

  // 투자금을 확정할 봇: 운용 시작일이 된 새 봇(ready), 실행 중, 자금 대기 중 (POL-FUND-09, 15).
  // 이미 확정된 봇은 FundService가 건너뛰어요
  async findFundable(today: string = kstDate()): Promise<Bot[]> {
    const bots = await this.bots.findByStatuses([
      'ready',
      'running',
      'waiting_funds',
    ]);
    return bots.filter(
      ({ status, periodStart }) => status !== 'ready' || periodStart <= today,
    );
  }

  // 신규 진입을 하지 않는 봇들 (재시작 때 정지 상태 복원)
  findInactive(): Promise<Bot[]> {
    return this.bots.findByStatuses(['paused', 'waiting_funds', 'stopped']);
  }

  setStatus(
    id: number,
    status: BotStatus,
    statusReason: string | null,
  ): Promise<void> {
    return this.bots.setStatus(id, status, statusReason);
  }

  stopAll(statusReason: string): Promise<void> {
    return this.bots.stopAll(statusReason);
  }
}
