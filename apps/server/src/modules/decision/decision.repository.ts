import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';

import type { AccuracyFilter } from './decision.types.js';
import { Decision } from './entities/decision.entity.js';
import { PredictionScore } from './entities/prediction-score.entity.js';

export type DecisionFields = Omit<
  Decision,
  'botVersion' | 'position' | 'createdAt'
>;

// decisions는 추가만 해요 (ADR-0003, DB 트리거가 UPDATE·DELETE를 막아요)
@Injectable()
export class DecisionRepository {
  // ponytail: 포지션 하나의 판단은 많아야 수십 개예요
  private static readonly MAX_POSITION_DECISIONS = 500;
  // ponytail: 정확도 분석은 기간 안 판단을 한 번에 읽어 계산해요. 많아지면 GROUP BY 쿼리로 바꿔요
  private static readonly MAX_ACCURACY_ROWS = 50_000;

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get decisions(): Repository<Decision> {
    return this.txHost.tx.getRepository(Decision);
  }

  private get scores(): Repository<PredictionScore> {
    return this.txHost.tx.getRepository(PredictionScore);
  }

  // 닫힌 포지션의 진입·재평가 판단 중 아직 채점하지 않은 것 (POL-REEV-04)
  findUnscored(take: number): Promise<Decision[]> {
    return this.decisions
      .createQueryBuilder('decision')
      .innerJoin('decision.position', 'position', "position.status = 'closed'")
      .leftJoin(PredictionScore, 'score', 'score.decisionId = decision.id')
      .where("decision.kind IN ('enter', 'reeval')")
      .andWhere('score.id IS NULL')
      .orderBy('decision.decidedAt', 'ASC')
      .take(take)
      .getMany();
  }

  async addScore(
    fields: Pick<
      PredictionScore,
      | 'positionId'
      | 'decisionId'
      | 'directionHit'
      | 'targetReachPct'
      | 'errorPct'
      | 'scoredAt'
    >,
  ): Promise<void> {
    await this.scores.insert(fields);
  }

  findEntry(positionId: number): Promise<Decision | null> {
    return this.decisions.findOne({
      where: { positionId, kind: 'enter' },
      order: { decidedAt: 'ASC' },
    });
  }

  // 포지션의 판단(진입·재평가·청산), 시간순
  findByPosition(positionId: number): Promise<Decision[]> {
    return this.decisions.find({
      where: { positionId },
      relations: { botVersion: true },
      order: { decidedAt: 'ASC' },
      take: DecisionRepository.MAX_POSITION_DECISIONS,
    });
  }

  findScoresByPosition(positionId: number): Promise<PredictionScore[]> {
    return this.scores.find({
      where: { positionId },
      take: DecisionRepository.MAX_POSITION_DECISIONS,
    });
  }

  // 기간(판단 시각)·봇으로 거른 채점, 판단의 봇 버전과 함께 (정확도 분석)
  findScored(filter: AccuracyFilter): Promise<PredictionScore[]> {
    const query = this.scores
      .createQueryBuilder('score')
      .innerJoinAndSelect('score.decision', 'decision')
      .innerJoinAndSelect('decision.botVersion', 'version');
    applyAccuracyFilter(query, filter);
    return query.take(DecisionRepository.MAX_ACCURACY_ROWS).getMany();
  }

  // 청산한(체결이 있던) 포지션의 진입 판단, 포지션과 함께 (신뢰 점수 구간별 승률)
  findClosedEntries(filter: AccuracyFilter): Promise<Decision[]> {
    const query = this.decisions
      .createQueryBuilder('decision')
      .innerJoinAndSelect('decision.position', 'position')
      .innerJoinAndSelect('decision.botVersion', 'version')
      .where("decision.kind = 'enter'")
      .andWhere("position.status = 'closed'")
      .andWhere("position.exitReason IS DISTINCT FROM 'not_filled'");
    applyAccuracyFilter(query, filter);
    return query.take(DecisionRepository.MAX_ACCURACY_ROWS).getMany();
  }

  async add(fields: DecisionFields): Promise<void> {
    await this.decisions.insert(fields);
  }
}

function applyAccuracyFilter(
  query: SelectQueryBuilder<Decision> | SelectQueryBuilder<PredictionScore>,
  filter: AccuracyFilter,
): void {
  if (filter.start)
    query.andWhere('decision.decidedAt >= :start', { start: filter.start });
  if (filter.end)
    query.andWhere('decision.decidedAt < :end', { end: filter.end });
  if (filter.botIds?.length)
    query.andWhere('version.botId IN (:...botIds)', { botIds: filter.botIds });
}
