// 순환 의존 검사(npm run lint:cycles). 레이어 규칙은 ESLint(boundaries)가 맡아요.
// 컴파일한 결과로 봐요(tsPreCompilationDeps: false). Nest는 생성자 주입 타입을 데코레이터 메타데이터로
// 실행할 때 불러와서, 타입으로만 쓴 import도 런타임 순환이에요. import type만 빠져요.
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        '순환 의존이에요. 의존 방향을 바꾸거나 공통 부분을 다른 feature로 옮겨요(harness.md 1절).',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'src/infra/database/migrations' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: false,
  },
};
