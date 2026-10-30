import { scorePrediction } from './scoring.rule.js';

describe('예측 채점 규칙', () => {
  const up = {
    direction: 'up' as const,
    entryPrice: 10_000,
    targetPrice: 10_300,
    exitPrice: 10_200,
    highPrice: 10_200,
    lowPrice: 9950,
  };

  it('상승 예측이 맞으면 방향 적중이고, 목표까지 간 비율과 오차를 계산해요', () => {
    expect(scorePrediction(up)).toEqual({
      directionHit: true,
      targetReachPct: 66.67,
      errorPct: -1,
    });
  });

  it('목표를 넘어도 도달률은 100%까지예요', () => {
    expect(
      scorePrediction({ ...up, highPrice: 10_500, exitPrice: 10_400 }),
    ).toMatchObject({ targetReachPct: 100, errorPct: 1 });
  });

  it('반대로 움직이면 방향이 틀리고 도달률은 0%예요', () => {
    expect(
      scorePrediction({ ...up, exitPrice: 9900, highPrice: 9990 }),
    ).toMatchObject({ directionHit: false, targetReachPct: 0 });
  });

  it('청산가가 진입가와 같으면 방향 적중이 아니에요', () => {
    expect(scorePrediction({ ...up, exitPrice: 10_000 }).directionHit).toBe(
      false,
    );
  });

  it('하락 예측은 최저가로 대칭해서 계산해요', () => {
    expect(
      scorePrediction({
        direction: 'down',
        entryPrice: 10_000,
        targetPrice: 9700,
        exitPrice: 9800,
        highPrice: 10_050,
        lowPrice: 9850,
      }),
    ).toEqual({ directionHit: true, targetReachPct: 50, errorPct: 1 });
  });

  it('최고가·최저가를 모르면 진입가와 청산가로 대신해요', () => {
    expect(
      scorePrediction({ ...up, highPrice: null, lowPrice: null }),
    ).toMatchObject({ targetReachPct: 66.67 });
  });

  it('목표가가 진입가 쪽으로 잘못 정해져 있으면 도달률은 0%예요', () => {
    expect(scorePrediction({ ...up, targetPrice: 9900 }).targetReachPct).toBe(
      0,
    );
  });
});
