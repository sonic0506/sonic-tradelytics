// 검증 구간 봇의 투자금 상한(원) (POL-RISK-09). 정책 문서의 예시 값이에요
export const VERIFICATION_CAP = 100_000;

// 비율은 소수 넷째 자리까지(numeric(5,4)). 합계 검사는 정수로 바꿔 소수 오차를 피해요
export const RATIO_SCALE = 10_000;

// 자금 부족 보류 사유 (bots.status_reason)
export const WAITING_REASONS = [
  'insufficient_funds',
  'below_order_size',
] as const;
export type WaitingReason = (typeof WAITING_REASONS)[number];
