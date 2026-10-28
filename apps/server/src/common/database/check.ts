// CHECK 제약 식을 만들어요. 값 목록은 각 feature *.constants.ts의 as const 배열이에요.
// column은 DB 이름(snake_case)이에요.
export const oneOf = (column: string, values: readonly string[]): string =>
  `"${column}" IN (${values.map((value) => `'${value}'`).join(', ')})`;
