// 투자금 입력 검사: 1원 이상의 정수, 지금 쓸 수 있는 운용 자산 이하
export type BudgetError = 'not_positive_integer' | 'over_available';

export function getBudgetError(
  value: string,
  available: number,
): BudgetError | null {
  const amount = Number(value);
  if (value.trim() === '' || !Number.isInteger(amount) || amount <= 0) {
    return 'not_positive_integer';
  }
  if (amount > available) return 'over_available';
  return null;
}
