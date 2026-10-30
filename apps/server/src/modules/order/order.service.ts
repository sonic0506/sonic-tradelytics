import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

import { kstDate } from '@/common/time/kst-date.js';
import { DecisionService } from '@/modules/decision/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { type ExitReason, PositionService } from '@/modules/position/index.js';
import { RiskService } from '@/modules/risk/index.js';

import type { BrokerOrder } from './entities/broker-order.entity.js';
import type { ProtectiveOrder } from './entities/protective-order.entity.js';
import {
  OPEN_ORDER_STATUSES,
  type OrderEventSource,
} from './order.constants.js';
import { OrderRepository } from './order.repository.js';
import type { ApplyResult, OrderReport } from './order.types.js';
import { TossBrokerService } from './toss-broker.service.js';

// 토스의 clientOrderId 중복 방지는 10분만 유효해요 (POL-RISK-07). 재전송은 여유를 두고 8분 안에서만 해요
const RESEND_WINDOW_MS = 480_000;

type DecisionRecord = Parameters<DecisionService['record']>[0];

// 진입 판단 1건과 주문 (docs/architecture/order-lifecycle.md 진입)
export interface EntryRequest {
  botId: number;
  botVersionId: number;
  symbol: string;
  // 지정가
  price: number;
  quantity: number;
  // 근거 카드에 남는 조건 결과와 예측 (FR-RAT)
  rationale: Pick<
    DecisionRecord,
    | 'passed'
    | 'failed'
    | 'score'
    | 'direction'
    | 'targetPrice'
    | 'stopPrice'
    | 'horizonMinutes'
  >;
}

// 청산 판단 1건과 매도 (docs/architecture/order-lifecycle.md 청산)
export interface ExitRequest {
  positionId: number;
  botVersionId: number;
  reason: ExitReason;
  // 시장가면 price null
  orderType: 'LIMIT' | 'MARKET';
  price: number | null;
  // 판단 기록의 기준 가격(지금가)
  markPrice: number;
  rationale: Pick<DecisionRecord, 'passed' | 'failed' | 'score'>;
}

export type ExitResult =
  | EntryResult
  // 판단할 포지션이나 보유 수량이 없어요
  | { status: 'nothing' }
  // 손절이 이미 발동돼 팔지 않았어요. 발동 주문이 포지션을 닫아요 (POL-RISK-14)
  | { status: 'stop_triggered' }
  // 손절 취소를 확인하지 못해 아직 팔지 않았어요. 다음 주기에 다시 해요
  | { status: 'not_ready' };

export type EntryResult =
  | { status: 'blocked' }
  | { status: 'skipped'; reason: 'symbol_lock' }
  | { status: 'accepted'; brokerOrderId: string }
  | { status: 'rejected'; code: string }
  // 접수됐는지 몰라요. recoverRequested가 정리해요
  | { status: 'pending' };

const OPEN_STATUSES: readonly string[] = OPEN_ORDER_STATUSES;

// 봇 하나의 미체결 주문 (POL-FUND-05, 12)
export interface BotOpenOrders {
  // 미체결 매수 주문 금액 = 남은 수량 × 지정가
  openBuyAmount: number;
  hasOpenOrders: boolean;
}

type Filled = Pick<
  BrokerOrder,
  'filledQuantity' | 'filledAmount' | 'commission' | 'tax'
>;
const NOTHING_FILLED: Filled = {
  filledQuantity: 0,
  filledAmount: null,
  commission: null,
  tax: null,
};

// 토스 주문 상태를 broker_orders에 맞춰요 (docs/architecture/order-lifecycle.md 재동기화).
// 주문 생성·취소와 손절 조건주문은 BotRunner를 만들 때 여기에 더해요.
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly orders: OrderRepository,
    private readonly positions: PositionService,
    private readonly decisions: DecisionService,
    private readonly broker: TossBrokerService,
    private readonly risk: RiskService,
    private readonly engineState: EngineStateService,
  ) {}

  // 진입: 종목 잠금 → 포지션·판단·주문(requested)을 한 트랜잭션으로 저장 → 정지 여부를 마지막으로 보고 주문 (ADR-0003, NFR-02)
  async enter(request: EntryRequest): Promise<EntryResult> {
    if (!this.canEnter(request.botId)) return { status: 'blocked' };
    const base = {
      botVersionId: request.botVersionId,
      symbol: request.symbol,
      price: request.price,
    };
    if (!(await this.risk.acquireLock(request.symbol, request.botId))) {
      await this.decisions.record({
        ...base,
        ...request.rationale,
        positionId: null,
        kind: 'skip',
        direction: null,
        targetPrice: null,
        stopPrice: null,
        skipReason: 'symbol_lock',
      });
      return { status: 'skipped', reason: 'symbol_lock' };
    }
    const order = await this.saveEntry(request);
    // 저장하는 사이에 킬 스위치·일시정지가 들어왔으면 보내지 않아요
    if (!this.canEnter(request.botId)) {
      await this.giveUp(order, request.botId, 'not_sent');
      return { status: 'blocked' };
    }
    return this.send(order, request.botId);
  }

  // engine 시작 순서 5번: 응답을 못 받은 주문을 정리해요 (docs/architecture/order-lifecycle.md 응답을 못 받았을 때)
  async recoverRequested(): Promise<void> {
    const requested = await this.orders.findRequested();
    await requested.reduce<Promise<void>>(
      (previous, order) => previous.then(() => this.recover(order)),
      Promise.resolve(),
    );
  }

  private async recover(order: BrokerOrder): Promise<void> {
    const botId = order.position.botId;
    if (botId === null) return;
    // 8분 안이면 같은 clientOrderId로 다시 보내요. 토스가 첫 결과를 돌려줘요.
    // 경과 시간은 주문마다 보내기 직전에 다시 재요(앞 주문을 정리하는 사이 10분이 지나 중복 주문이 나가지 않게)
    if (Date.now() - order.createdAt.getTime() < RESEND_WINDOW_MS) {
      const canResend =
        this.engineState.canOrder() &&
        (order.side === 'SELL' || this.engineState.canEnter(botId));
      if (canResend) await this.send(order, botId);
      return;
    }
    // 10분이 지나면 다시 보내지 않고, 같은 종목·방향·수량·가격으로 그 뒤에 접수된 주문을 찾아요
    const candidates = (
      await this.broker.listOrders(order.symbol, kstDate(order.createdAt))
    ).filter(
      (candidate) =>
        candidate.side === order.side &&
        candidate.quantity === order.quantity &&
        candidate.price === order.price &&
        candidate.orderedAt >= order.createdAt,
    );
    const linked = await this.orders.linkedBrokerOrderIds(
      candidates.map(({ brokerOrderId }) => brokerOrderId),
    );
    const free = candidates.filter(
      ({ brokerOrderId }) => !linked.has(brokerOrderId),
    );
    const [only] = free;
    if (free.length === 1 && only) {
      // 상태·체결은 다음 재동기화(applyReport)가 채워요
      await this.orders.update(order.id, {
        brokerOrderId: only.brokerOrderId,
        status: 'PENDING',
        orderedAt: only.orderedAt,
      });
      return;
    }
    if (free.length === 0) {
      await this.giveUp(order, botId, 'not_found');
      return;
    }
    // 고르지 않아요. 그 봇의 신규 진입을 멈추고 사람이 확인하게 알려요
    this.engineState.blockBot(botId, 'ambiguous_order');
    await this.risk.record('order_rejected', botId, {
      reason: 'ambiguous_recovery',
      orderId: order.id,
      candidates: free.map(({ brokerOrderId }) => brokerOrderId),
    });
  }

  private canEnter(botId: number): boolean {
    return this.engineState.canOrder() && this.engineState.canEnter(botId);
  }

  @Transactional()
  private async saveEntry(request: EntryRequest): Promise<BrokerOrder> {
    const position = await this.positions.openForBot(
      request.botId,
      request.symbol,
      new Date(),
    );
    const decisionId = await this.decisions.record({
      ...request.rationale,
      botVersionId: request.botVersionId,
      positionId: position.id,
      symbol: request.symbol,
      kind: 'enter',
      price: request.price,
      skipReason: null,
    });
    return this.orders.create({
      origin: 'bot',
      decisionId,
      positionId: position.id,
      brokerOrderId: null,
      symbol: request.symbol,
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      price: request.price,
      quantity: request.quantity,
      status: 'requested',
      rejectCode: null,
      filledQuantity: 0,
      avgFilledPrice: null,
      filledAmount: null,
      commission: null,
      tax: null,
      orderedAt: null,
      filledAt: null,
      canceledAt: null,
      settlementDate: null,
      syncedAt: null,
    });
  }

  private async send(order: BrokerOrder, botId: number): Promise<EntryResult> {
    if (order.decisionId === null) return { status: 'pending' };
    const result = await this.broker.place({
      clientOrderId: order.decisionId,
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      price: order.price,
      quantity: order.quantity,
    });
    if (result.outcome === 'accepted') {
      await this.orders.update(order.id, {
        brokerOrderId: result.brokerOrderId,
        status: 'PENDING',
        orderedAt: new Date(),
      });
      return { status: 'accepted', brokerOrderId: result.brokerOrderId };
    }
    if (result.outcome === 'unknown') {
      this.logger.warn(
        `주문 ${order.id} 응답을 못 받았어요(${result.reason}). 다시 확인해요`,
      );
      return { status: 'pending' };
    }
    await this.giveUp(order, botId, result.code);
    // 같은 id로 다른 내용을 보낸 코드 버그예요. 그 봇을 멈추고 알려요
    if (result.code === 'idempotency-key-conflict') {
      this.engineState.blockBot(botId, 'order_rejected');
      await this.risk.record('order_rejected', botId, {
        code: result.code,
        orderId: order.id,
      });
    }
    return { status: 'rejected', code: result.code };
  }

  // 토스에 주문이 생기지 않았어요: request_failed, 체결 없는 포지션은 not_filled로 닫고 잠금을 풀어요
  private async giveUp(
    order: BrokerOrder,
    botId: number,
    code: string,
  ): Promise<void> {
    const isClosed = await this.saveFailure(order, code);
    if (isClosed) await this.risk.releaseLock(order.symbol, botId);
  }

  @Transactional()
  private async saveFailure(
    order: BrokerOrder,
    code: string,
  ): Promise<boolean> {
    await this.orders.update(order.id, {
      status: 'request_failed',
      rejectCode: code,
    });
    return this.positions.closeNotFilled(order.positionId, new Date());
  }

  // ponytail: 시장가 매수는 가격을 몰라 0원으로 봐요. 봇은 지정가로 사고, 시장가는 손절·청산 매도에만 써요
  async openOrdersByBot(botIds: number[]): Promise<Map<number, BotOpenOrders>> {
    const result = new Map<number, BotOpenOrders>(
      botIds.map((botId) => [
        botId,
        { openBuyAmount: 0, hasOpenOrders: false },
      ]),
    );
    if (botIds.length === 0) return result;
    for (const order of await this.orders.findOpenForBots(botIds)) {
      const open =
        order.position.botId === null
          ? undefined
          : result.get(order.position.botId);
      if (!open) continue;
      open.hasOpenOrders = true;
      if (order.side === 'BUY')
        open.openBuyAmount +=
          (order.quantity - order.filledQuantity) * (order.price ?? 0);
    }
    return result;
  }

  // 토스가 알려 준 주문 1건을 반영해요. 같은 값을 여러 번 받아도 결과가 같아요
  async applyReport(
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<ApplyResult> {
    const result = await this.saveReport(report, source);
    if (result === 'updated' || result === 'created')
      await this.afterReport(report.brokerOrderId);
    return result;
  }

  // 체결이 반영된 뒤(트랜잭션 밖, 토스 호출 포함): 봇 포지션이 0주면 닫고 잠금을 풀고, 남아 있으면 손절을 맞춰요
  private async afterReport(brokerOrderId: string): Promise<void> {
    const order = await this.orders.findByBrokerOrderId(brokerOrderId);
    if (!order) return;
    const position = await this.positions.find(order.positionId);
    if (position?.status !== 'open') return;
    // 직접 거래: 체결 없이 끝난 주문만 남은 0주 포지션을 닫아요(매도로 0주가 되면 체결 반영 때 이미 닫혀요)
    if (position.botId === null) {
      if (
        position.quantity === 0 &&
        !(await this.orders.hasOpenOrders(position.id))
      )
        await this.positions.closeFlat(position.id, 'not_filled', new Date());
      return;
    }
    if (position.quantity > 0) {
      await this.protect(position.id);
      return;
    }
    // 매수 체결이 하나도 없는 진입 주문이 아직 살아 있으면 기다려요
    if (await this.orders.hasOpenOrders(position.id)) return;
    if (await this.orders.findLiveProtective(position.id)) return;
    const reason =
      order.origin === 'protective'
        ? 'stop_loss'
        : (position.exitReason ?? 'not_filled');
    if (await this.positions.closeFlat(position.id, reason, new Date()))
      await this.risk.releaseLock(position.symbol, position.botId);
  }

  // POL-RISK-11: 보유 수량만큼 SINGLE + 시장가 매도 손절을 걸어요. 수량이 바뀌면 취소를 확인한 뒤 다시 걸어요
  async protect(positionId: number): Promise<void> {
    const position = await this.positions.find(positionId);
    if (position?.botId === null || position?.status !== 'open') return;
    const live = await this.orders.findLiveProtective(positionId);
    if (live?.status === 'open' && live.quantity === position.quantity) return;
    if (live && (await this.cancelProtective(live)) !== 'canceled') return;
    if (position.quantity === 0) return;
    const triggerPrice = await this.decisions.entryStopPrice(positionId);
    if (triggerPrice === null) {
      this.logger.error(
        `position ${positionId}: 손절가가 없어 손절을 걸지 못했어요`,
      );
      return;
    }
    // ponytail: 만료일은 당일이에요(당일 청산 봇). 이월 봇(M6)을 만들 때 최대 보유일로 바꿔요
    const stop = await this.orders.addProtective({
      positionId,
      brokerConditionalOrderId: null,
      clientOrderId: randomUUID(),
      triggerPrice,
      quantity: position.quantity,
      expireDate: kstDate(),
      status: 'requested',
      triggeredOrderId: null,
      closedAt: null,
    });
    const result = await this.broker.placeStop({
      clientOrderId: stop.clientOrderId,
      symbol: position.symbol,
      quantity: stop.quantity,
      triggerPrice,
      expireDate: stop.expireDate,
    });
    if (result.outcome === 'accepted') {
      await this.orders.updateProtective(stop.id, {
        status: 'open',
        brokerConditionalOrderId: result.conditionalOrderId,
      });
      return;
    }
    if (result.outcome === 'rejected') {
      await this.orders.updateProtective(stop.id, {
        status: 'canceled',
        closedAt: new Date(),
      });
      // 손절 공백이에요. 바로 알려요
      await this.risk.record('order_rejected', position.botId, {
        kind: 'protective',
        code: result.code,
        positionId,
      });
      return;
    }
    // ponytail: 응답을 못 받은 손절은 requested로 남겨요. 다음 체결 반영이나 청산 때 다시 맞춰요
    this.logger.warn(
      `position ${positionId}: 손절 응답을 못 받았어요(${result.reason})`,
    );
  }

  // 일시정지·청산·킬 스위치: 봇 미체결 주문을 취소해요. 결과(CANCELED)는 재동기화로 반영돼요. 취소하지 못한 수를 돌려줘요
  async cancelOpen(filter: { botId?: number; side?: 'BUY' }): Promise<number> {
    const open = (await this.orders.findOpenBotOrders(filter.botId)).filter(
      ({ side }) => filter.side === undefined || side === filter.side,
    );
    const results = await open.reduce<Promise<boolean[]>>(
      (previous, order) =>
        previous.then(async (done) => [
          ...done,
          order.brokerOrderId === null
            ? false
            : await this.broker.cancel(order.brokerOrderId),
        ]),
      Promise.resolve([]),
    );
    return results.filter((isCanceled) => !isCanceled).length;
  }

  // 봇의 보유 포지션을 시장가로 청산해요(청산 순서는 exit과 같아요). 팔지 못한 포지션 수를 돌려줘요
  // ponytail: 명령에는 지금가가 없어서 판단 기준 가격으로 평균 매수가를 남겨요. BotRunner가 생기면 시세 스냅샷으로 바꿔요
  async liquidate(reason: ExitReason, botId?: number): Promise<number> {
    const held = await this.positions.findHeldByBot(botId);
    const results = await held.reduce<Promise<ExitResult[]>>(
      (previous, position) =>
        previous.then(async (done) => {
          const botVersionId = await this.decisions.entryVersionId(position.id);
          if (botVersionId === null) return [...done, { status: 'nothing' }];
          return [
            ...done,
            await this.exit({
              positionId: position.id,
              botVersionId,
              reason,
              orderType: 'MARKET',
              price: null,
              markPrice: Math.round(position.costBasis / position.quantity),
              rationale: { passed: [], failed: [], score: null },
            }),
          ];
        }),
      Promise.resolve([]),
    );
    return results.filter(
      ({ status }) =>
        !['accepted', 'pending', 'stop_triggered'].includes(status),
    ).length;
  }

  // POL-RISK-14: 손절 취소 확인 → 청산 판단·매도. 이미 발동됐으면 팔지 않아요
  async exit(request: ExitRequest): Promise<ExitResult> {
    if (!this.engineState.canOrder()) return { status: 'blocked' };
    const position = await this.positions.find(request.positionId);
    if (
      position?.botId === null ||
      position?.status !== 'open' ||
      position.quantity === 0
    )
      return { status: 'nothing' };
    const botId = position.botId;
    await this.positions.setExitReason(position.id, request.reason);
    const live = await this.orders.findLiveProtective(position.id);
    if (live) {
      const canceled = await this.cancelProtective(live);
      if (canceled === 'triggered') {
        await this.positions.setExitReason(position.id, 'stop_loss');
        return { status: 'stop_triggered' };
      }
      if (canceled === 'unknown') return { status: 'not_ready' };
    }
    const order = await this.saveExit(
      request,
      position.symbol,
      position.quantity,
    );
    const result = await this.send(order, botId);
    if (result.status === 'rejected') {
      // 예: 직접 거래 반대 방향 미체결(409). 재시도하지 않고 알리고, 손절이 비지 않게 다시 걸어요
      await this.risk.record('order_rejected', botId, {
        kind: 'exit',
        code: result.code,
        positionId: position.id,
      });
      await this.protect(position.id);
    }
    return result;
  }

  // 취소를 확인하면 canceled, 이미 발동됐으면 triggered, 확인하지 못하면 unknown
  private async cancelProtective(
    stop: ProtectiveOrder,
  ): Promise<'canceled' | 'triggered' | 'unknown'> {
    const id = stop.brokerConditionalOrderId;
    if (id === null) {
      // ponytail: 응답을 못 받은 손절은 토스에 있는지 몰라요. 같은 clientOrderId로 조회할 방법이 생기면 확인해요
      await this.orders.updateProtective(stop.id, {
        status: 'canceled',
        closedAt: new Date(),
      });
      return 'canceled';
    }
    await this.orders.updateProtective(stop.id, { status: 'canceling' });
    if (await this.broker.cancelStop(id)) {
      await this.orders.updateProtective(stop.id, {
        status: 'canceled',
        closedAt: new Date(),
      });
      return 'canceled';
    }
    const state = await this.broker.stopState(id);
    if (state.isTriggered) {
      await this.orders.updateProtective(stop.id, {
        status: 'triggered',
        triggeredOrderId: state.triggeredOrderId,
        closedAt: new Date(),
      });
      return 'triggered';
    }
    return 'unknown';
  }

  @Transactional()
  private async saveExit(
    request: ExitRequest,
    symbol: string,
    quantity: number,
  ): Promise<BrokerOrder> {
    const decisionId = await this.decisions.record({
      ...request.rationale,
      botVersionId: request.botVersionId,
      positionId: request.positionId,
      symbol,
      kind: 'exit',
      price: request.markPrice,
      direction: null,
      targetPrice: null,
      stopPrice: null,
      horizonMinutes: null,
      skipReason: null,
    });
    return this.orders.create({
      origin: 'bot',
      decisionId,
      positionId: request.positionId,
      brokerOrderId: null,
      symbol,
      side: 'SELL',
      orderType: request.orderType,
      timeInForce: 'DAY',
      price: request.price,
      quantity,
      status: 'requested',
      rejectCode: null,
      filledQuantity: 0,
      avgFilledPrice: null,
      filledAmount: null,
      commission: null,
      tax: null,
      orderedAt: null,
      filledAt: null,
      canceledAt: null,
      settlementDate: null,
      syncedAt: null,
    });
  }

  @Transactional()
  private async saveReport(
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<ApplyResult> {
    // 취소 거부는 토스가 따로 만드는 레코드예요. 원주문은 이전 상태로 돌아가서 원주문만 따라가요
    if (report.status === 'CANCEL_REJECTED') return 'ignored';

    const known = await this.orders.findByBrokerOrderId(report.brokerOrderId);
    if (known) return this.update(known, report, source);
    return this.classify(report, source);
  }

  private async update(
    order: BrokerOrder,
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<ApplyResult> {
    const syncedAt = source === 'rest' ? new Date() : order.syncedAt;
    // 늦게 온 옛 값(체결이 줄거나, 끝난 주문이 다시 미체결)은 반영하지 않아요
    const isStale =
      report.filledQuantity < order.filledQuantity ||
      (!OPEN_STATUSES.includes(order.status) &&
        OPEN_STATUSES.includes(report.status));
    if (isStale) return 'unchanged';
    // 체결 수량이 같아도 수수료·세금·체결 금액·체결 시각은 REST가 나중에 채워요 (실제 토스 확인 2026-10-30)
    const isSame =
      report.filledQuantity === order.filledQuantity &&
      report.status === order.status &&
      report.filledAmount === order.filledAmount &&
      report.commission === order.commission &&
      report.tax === order.tax &&
      (report.filledAt === null ||
        report.filledAt.getTime() === order.filledAt?.getTime());
    if (isSame) {
      if (source === 'rest') await this.orders.update(order.id, { syncedAt });
      return 'unchanged';
    }

    await this.orders.update(order.id, {
      status: report.status,
      filledQuantity: report.filledQuantity,
      avgFilledPrice: report.avgFilledPrice,
      filledAmount: report.filledAmount,
      commission: report.commission,
      tax: report.tax,
      orderedAt: report.orderedAt,
      // 웹소켓 이벤트에는 체결 시각이 없어요
      filledAt: report.filledAt ?? order.filledAt,
      canceledAt: report.canceledAt,
      settlementDate: report.settlementDate,
      syncedAt,
    });
    await this.record(order.id, order.positionId, order, report, source);
    return 'updated';
  }

  // 모르는 주문: 손절 발동 주문 → 응답을 못 받은 봇 주문 후보 → 직접 거래 순서로 봐요 (FR-MAN-01)
  private async classify(
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<ApplyResult> {
    // 발동 주문 id를 아직 모르면 같은 종목·수량의 살아 있는 손절 매도로 봐요
    const protective =
      (await this.orders.findProtectiveByTriggeredOrderId(
        report.brokerOrderId,
      )) ??
      (report.side === 'SELL'
        ? await this.orders.findLiveProtectiveFor(
            report.symbol,
            report.quantity,
          )
        : null);
    if (protective && protective.triggeredOrderId === null)
      await this.orders.updateProtective(protective.id, {
        status: 'triggered',
        triggeredOrderId: report.brokerOrderId,
        closedAt: new Date(),
      });
    if (!protective && (await this.orders.hasLostCandidate(report))) {
      this.logger.warn(
        `응답을 못 받은 봇 주문일 수 있어 분류하지 않았어요: ${report.symbol} ${report.side} ${report.quantity}주`,
      );
      return 'pending_recovery';
    }

    const positionId =
      protective?.positionId ??
      (await this.positions.openManual(report.symbol, report.orderedAt)).id;
    const created = await this.orders.create({
      origin: protective ? 'protective' : 'manual',
      decisionId: null,
      positionId,
      brokerOrderId: report.brokerOrderId,
      symbol: report.symbol,
      side: report.side,
      orderType: report.orderType,
      timeInForce: report.timeInForce,
      price: report.price,
      quantity: report.quantity,
      status: report.status,
      rejectCode: null,
      filledQuantity: report.filledQuantity,
      avgFilledPrice: report.avgFilledPrice,
      filledAmount: report.filledAmount,
      commission: report.commission,
      tax: report.tax,
      orderedAt: report.orderedAt,
      filledAt: report.filledAt,
      canceledAt: report.canceledAt,
      settlementDate: report.settlementDate,
      syncedAt: source === 'rest' ? new Date() : null,
    });
    await this.record(created.id, positionId, NOTHING_FILLED, report, source);
    return 'created';
  }

  // 상태 변화 이력을 남기고, 체결이 늘었으면 포지션에 반영해요
  private async record(
    orderId: number,
    positionId: number,
    before: Filled,
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<void> {
    const quantity = report.filledQuantity - before.filledQuantity;
    const amount = (report.filledAmount ?? 0) - (before.filledAmount ?? 0);
    const fees =
      (report.commission ?? 0) +
      (report.tax ?? 0) -
      (before.commission ?? 0) -
      (before.tax ?? 0);
    const occurredAt = report.filledAt ?? report.canceledAt ?? new Date();

    await this.orders.addEvent({
      orderId,
      source,
      status: report.status,
      filledQuantityDelta: quantity,
      // 이번에 늘어난 체결분의 평균가
      fillPrice: quantity > 0 ? Math.round(amount / quantity) : null,
      occurredAt,
      raw: report.raw,
    });
    // 체결 없이 수수료·세금만 확정되면 그 차이만 손익에서 빼요
    if (quantity === 0 && fees !== 0)
      await this.positions.addFees(positionId, fees);
    if (quantity > 0)
      await this.positions.applyFill(positionId, {
        side: report.side,
        quantity,
        amount,
        fees,
        at: occurredAt,
      });
  }
}
