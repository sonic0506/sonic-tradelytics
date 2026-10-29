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
    // 이 프로젝트만의 규칙
    {
      name: 'api-no-toss',
      severity: 'error',
      comment:
        'api(main.ts)에서 토스 클라이언트까지 가는 경로예요. 토스는 engine에서만 불러요(ADR-0002). engine 전용 모듈을 AppModule에 넣지 않아요.',
      from: { path: '^src/main\\.ts$' },
      to: { path: '^src/infra/toss/', reachable: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'src/infra/database/migrations' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: false,
  },
};
