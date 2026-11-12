// 정확도 분석 필터: 판단 시각 [start, end), 봇
export interface AccuracyFilter {
  start?: Date;
  end?: Date;
  botIds?: number[];
}
