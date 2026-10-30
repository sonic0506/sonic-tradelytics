import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';

import { Decision } from './entities/decision.entity.js';
import { PredictionScore } from './entities/prediction-score.entity.js';

export type DecisionFields = Omit<
  Decision,
  'botVersion' | 'position' | 'createdAt'
>;

// decisions는 추가만 해요 (ADR-0003, DB 트리거가 UPDATE·DELETE를 막아요)
@Injectable()
export class DecisionRepository {
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

  async add(fields: DecisionFields): Promise<void> {
    await this.decisions.insert(fields);
  }
}
