import { Test } from '@nestjs/testing';

import { DecisionRepository } from './decision.repository.js';
import { DecisionService } from './decision.service.js';
import type { Decision } from './entities/decision.entity.js';
import type { PredictionScore } from './entities/prediction-score.entity.js';

describe('DecisionService', () => {
  const decisions = {
    findByPosition: vi.fn<DecisionRepository['findByPosition']>(),
    findScoresByPosition: vi.fn<DecisionRepository['findScoresByPosition']>(),
    findScored: vi.fn<DecisionRepository['findScored']>(),
    findClosedEntries: vi.fn<DecisionRepository['findClosedEntries']>(),
  };
  let service: DecisionService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DecisionService,
        { provide: DecisionRepository, useValue: decisions },
      ],
    }).compile();
    service = moduleRef.get(DecisionService);
  });

  it('포지션의 판단과 채점을 함께 줘요', async () => {
    const decision = Object.assign({ id: 'd-1' }) as Decision;
    const score = Object.assign({ decisionId: 'd-1' }) as PredictionScore;
    decisions.findByPosition.mockResolvedValue([decision]);
    decisions.findScoresByPosition.mockResolvedValue([score]);

    await expect(service.forPosition(7)).resolves.toEqual({
      decisions: [decision],
      scores: [score],
    });
    expect(decisions.findByPosition).toHaveBeenCalledWith(7);
  });

  it('정확도 분석: 채점을 전체·봇별로 요약하고, 청산한 진입 판단을 점수 구간으로 나눠요', async () => {
    const scored = (botId: number, directionHit: boolean) =>
      Object.assign({
        directionHit,
        targetReachPct: 50,
        errorPct: 1,
        decision: Object.assign({ botVersion: { botId } }) as Decision,
      }) as PredictionScore;
    decisions.findScored.mockResolvedValue([
      scored(7, true),
      scored(7, false),
      scored(8, true),
    ]);
    decisions.findClosedEntries.mockResolvedValue([
      Object.assign({ score: 85, position: { realizedPnl: 100 } }) as Decision,
      Object.assign({
        score: null,
        position: { realizedPnl: 100 },
      }) as Decision,
    ]);
    const filter = { botIds: [7, 8] };

    const accuracy = await service.accuracy(filter);

    expect(decisions.findScored).toHaveBeenCalledWith(filter);
    expect(accuracy.overall).toMatchObject({
      scoredCount: 3,
      directionHitRate: 0.67,
    });
    expect(accuracy.byBot.get(7)).toMatchObject({
      scoredCount: 2,
      directionHitRate: 0.5,
      targetReachRate: 0.5,
    });
    expect(accuracy.buckets[1]).toEqual({
      min: 80,
      max: 89,
      closedCount: 1,
      winRate: 1,
    });
  });
});
