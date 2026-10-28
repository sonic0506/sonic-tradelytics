// pg는 numeric을 정밀도를 지키려고 문자열로 줘요. 비율·%·평균가는 소수 4자리 이하라 number로 바꿔도 돼요.
// TypeORM ValueTransformer 모양이에요(common은 typeorm을 가져오지 않아요).
export const numericTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};
