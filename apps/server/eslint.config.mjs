// 프로젝트 소유 파일이에요. 하네스 공통 규칙(.sonic-harness-be/)을 불러오고, 이 프로젝트만의 규칙은 아래에 더해요.
import harness from './.sonic-harness-be/eslint.base.mjs';

export default [
  ...harness,
  // 이 프로젝트만의 규칙
];
