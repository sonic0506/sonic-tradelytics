import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  type AccuracyRates,
  accuracyRates,
  type ScoreBucket,
  scoreBuckets,
} from './accuracy.rule.js';
import {
  type DecisionFields,
  DecisionRepository,
} from './decision.repository.js';
import type { AccuracyFilter } from './decision.types.js';
import type { Decision } from './entities/decision.entity.js';
import type { PredictionScore as ScoreRecord } from './entities/prediction-score.entity.js';
import type { PredictionScore } from './scoring.rule.js';

// 판단 기록 (ADR-0003). 주문 전에 저장하고, id가 그대로 clientOrderId가 돼요 (POL-RISK-07)
@Injectable()
export class DecisionService {
  constructor(private readonly decisions: DecisionRepository) {}

  findUnscored(take: number): Promise<Decision[]> {
    return this.decisions.findUnscored(take);
  }

  // 채점 결과는 추가만 해요 (판단 1개 = 채점 1개, decision_id unique)
  saveScore(
    decision: Pick<Decision, 'id' | 'positionId'>,
    score: PredictionScore,
  ): Promise<void> {
    if (decision.positionId === null) return Promise.resolve();
    return this.decisions.addScore({
      positionId: decision.positionId,
      decisionId: decision.id,
      ...score,
      scoredAt: new Date(),
    });
  }

  // 그 포지션 첫 진입 판단의 봇 버전 (청산 판단도 진입 때 버전으로 남겨요)
  async entryVersionId(positionId: number): Promise<number | null> {
    return (await this.decisions.findEntry(positionId))?.botVersionId ?? null;
  }

  // 그 포지션 첫 진입 판단의 손절가 (손절 조건주문 발동가, POL-RISK-11)
  async entryStopPrice(positionId: number): Promise<number | null> {
    return (await this.decisions.findEntry(positionId))?.stopPrice ?? null;
  }

  // 저장한 판단 id를 돌려줘요. 호출하는 쪽 트랜잭션 안에서 함께 저장돼요
  async record(
    fields: Omit<DecisionFields, 'id' | 'decidedAt'>,
  ): Promise<string> {
    const id = randomUUID();
    await this.decisions.add({ ...fields, id, decidedAt: new Date() });
    return id;
  }

  // 포지션 하나의 판단(시간순)과 채점 (근거 카드, F3)
  async forPosition(
    positionId: number,
  ): Promise<{ decisions: Decision[]; scores: ScoreRecord[] }> {
    const [decisions, scores] = await Promise.all([
      this.decisions.findByPosition(positionId),
      this.decisions.findScoresByPosition(positionId),
    ]);
    return { decisions, scores };
  }

  // 정확도 분석 (FR-RAT-05, 06): 전체·봇별 채점 요약과 신뢰 점수 구간별 승률
  async accuracy(filter: AccuracyFilter): Promise<{
    overall: AccuracyRates;
    byBot: Map<number, AccuracyRates>;
    buckets: ScoreBucket[];
  }> {
    const [scored, entries] = await Promise.all([
      this.decisions.findScored(filter),
      this.decisions.findClosedEntries(filter),
    ]);
    const predictions = scored.map((score) => ({
      botId: score.decision.botVersion.botId,
      directionHit: score.directionHit,
      targetReachPct: score.targetReachPct,
      errorPct: score.errorPct,
    }));
    const botIds = [...new Set(predictions.map(({ botId }) => botId))];
    return {
      overall: accuracyRates(predictions),
      byBot: new Map(
        botIds.map((botId) => [
          botId,
          accuracyRates(predictions.filter((p) => p.botId === botId)),
        ]),
      ),
      buckets: scoreBuckets(
        entries.flatMap(({ score, position }) =>
          score === null || !position
            ? []
            : [{ score, netPnl: position.realizedPnl }],
        ),
      ),
    };
  }
}
