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
      // feature index.ts는 토스를 쓰는 service도 다시 내보내서, infra/toss 파일 전체를 막으면 index를 하나만 가져와도 걸려요.
      // 그래서 토스 DI 모듈(TossModule)을 막아요. TossModule이 없으면 api에서 TossClient를 주입받는 순간 앱이 뜨지 않아요
      // (AppModule만 띄우는 e2e가 매번 확인해요)
      comment:
        'api(main.ts)에서 토스 DI 모듈(TossModule)까지 가는 경로예요. 토스는 engine에서만 불러요(ADR-0002). TossModule은 EngineAppModule만 가져와요.',
      from: { path: '^src/main\\.ts$' },
      to: { path: '^src/infra/toss/toss\\.module\\.ts$', reachable: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'src/infra/database/migrations' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: false,
  },
};
