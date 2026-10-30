// 손익 추이 기간 (Figma ToggleGroup 1주 · 1개월 · 3개월 · 전체)
export const PNL_PERIODS = ['1w', '1m', '3m', 'all'] as const;
export type PnlPeriod = (typeof PNL_PERIODS)[number];

export const PNL_PERIOD_LABEL: Record<PnlPeriod, string> = {
  '1w': '1주',
  '1m': '1개월',
  '3m': '3개월',
  all: '전체',
};

// 기간 시작까지 거슬러 갈 달력 날짜 수. 전체는 null
export const PNL_PERIOD_DAYS: Record<PnlPeriod, number | null> = {
  '1w': 7,
  '1m': 31,
  '3m': 92,
  all: null,
};
