// 하네스 공통 ESLint 규칙. 프로젝트에서는 .sonic-harness/eslint.base.mjs로 들어가요.
// 설명과 예시는 harness.md에 있어요. 이 프로젝트만의 규칙은 프로젝트 eslint.config.mjs에 둬요.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import boundaries from 'eslint-plugin-boundaries';
import checkFile from 'eslint-plugin-check-file';
import globals from 'globals';
import pluginQuery from '@tanstack/eslint-plugin-query';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import testingLibrary from 'eslint-plugin-testing-library';
import vitest from '@vitest/eslint-plugin';
import sonic from './eslint-plugin-sonic.mjs';
// sonic-ui 디자인 규칙(eslint-design-rules)이 no-restricted-syntax를 쓰므로 하네스는 그 규칙을 쓰지 않아요
// (flat config는 같은 규칙을 덮어써요).

const SRC = 'src/**/*.{ts,tsx}';
const TEST = 'src/**/*.test.{ts,tsx}';
// 테스트 이름은 해요체 문장이에요: it('검색어가 있으면 그 결과만 보여 줘요')
const TITLE = '요[.!?]?$';
const TITLE_MESSAGE = "테스트 이름은 '~하면 ~해요'처럼 해요체 문장으로 써요.";

// 레이어 순서: 위 레이어는 아래 레이어만 가져올 수 있어요.
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
const below = (layer) => LAYERS.slice(LAYERS.indexOf(layer) + 1);

// import 제한. 위치마다 풀어 주는 항목이 달라서 이름으로 묶고, 아래 restricted()로 조합해요
// (flat config에서는 같은 규칙의 옵션이 합쳐지지 않고 덮어써져요).
const RESTRICTED = {
  useQuery: {
    name: '@tanstack/react-query',
    importNames: ['useQuery', 'useQueries'],
    message:
      '조회는 useSuspenseQuery를 써요. 로딩·에러는 Suspense와 ErrorBoundary가 맡아요.',
  },
  axios: {
    name: 'axios',
    message: 'HTTP는 shared/api의 http 클라이언트를 써요.',
  },
  zustand: {
    name: 'zustand',
    message:
      'Zustand는 store/ segment에서만 써요. 여러 화면이 함께 쓰는 클라이언트 상태(로그인 정보, UI 환경설정)만 두고, 새 store는 먼저 사용자에게 물어봐요.',
  },
  createContext: {
    name: 'react',
    importNames: ['createContext'],
    message:
      'Context는 묶인 컴포넌트(compound) 내부 상태 전달용으로만, 그 컴포넌트 옆 ui/에서 만들어요. 화면 사이 공유는 Zustand, 서버 데이터는 Query예요.',
  },
  nuqs: {
    name: 'nuqs',
    message:
      'URL 상태 훅은 slice의 model/(use-*-search-params.ts)에 만들고, 화면에서는 그 훅을 써요.',
  },
  ...Object.fromEntries(
    ['react-router', 'react-router-dom', 'next/navigation'].map((name) => [
      `searchParams:${name}`,
      {
        name,
        importNames: ['useSearchParams'],
        message:
          'URL 상태는 nuqs로 다뤄요. slice의 model/에 use-*-search-params.ts 훅을 만들어 써요.',
      },
    ]),
  ),
};
const restricted = (...allowed) =>
  Object.entries(RESTRICTED)
    .filter(([key]) => !allowed.includes(key))
    .map(([, path]) => path);
const SERVER_ONLY = {
  group: ['*.server', '**/*.server', '*.server.*', '**/*.server.*'],
  message:
    'ui/ 컴포넌트는 서버 전용 모듈(*.server.ts)을 가져오지 않아요. 서버에서 불러온 값은 props나 Query hydration으로 받아요.',
};
const PROPS_ONLY =
  'entities/*/ui는 props로만 데이터를 받아요. 조회 훅은 widgets/pages에서 불러 내려 줘요.';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'build',
      'storybook-static',
      '.next',
      'coverage',
      'playwright-report',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  { files: ['src/**'], languageOptions: { globals: globals.browser } },
  {
    files: ['*.{js,mjs,cjs,ts}', 'scripts/**', 'tests/**/*.mjs', 'e2e/**'],
    languageOptions: { globals: globals.node },
  },

  // 이름 규칙
  {
    files: [SRC],
    plugins: { 'check-file': checkFile },
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'check-file/filename-naming-convention': [
        'error',
        { 'src/**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': [
        'error',
        { 'src/**/': 'KEBAB_CASE' },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
        // 라이브러리가 정한 이름을 꺼내 쓰는 경우는 검사하지 않아요.
        {
          selector: 'variable',
          types: ['boolean'],
          modifiers: ['destructured'],
          format: null,
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can'],
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
      ],
    },
  },

  // FSD 레이어 경계
  {
    files: [SRC],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      // 진입 파일(src/main.tsx 등)은 레이어 밖이라 검사하지 않아요. main.tsx는 @/app만 불러요.
      'boundaries/include': [
        'src/{app,pages,widgets,features,entities,shared}/**/*',
      ],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'pages', pattern: 'src/pages/*', capture: ['slice'] },
        { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
        {
          type: 'features',
          pattern: 'src/features/*/*',
          capture: ['domain', 'slice'],
        },
        { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
        { type: 'shared', pattern: 'src/shared' },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            'FSD: {{from.element.type}} → {{to.element.type}} import는 안 돼요. 아래 레이어의 다른 slice만, 그 index.ts로 가져와요(app → pages → widgets → features → entities → shared).',
          policies: [
            // 같은 slice 안은 자유롭게
            { allow: { dependency: { relationship: { to: 'internal' } } } },
            { allow: { to: { module: { origin: 'external' } } } },
            // 아래 레이어 slice는 public API(index.ts)로만
            ...LAYERS.slice(0, -2).map((layer) => ({
              from: { element: { type: layer } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: below(layer).filter((t) => t !== 'shared'),
                    },
                    fileInternalPath: 'index.{ts,tsx}',
                  },
                },
              },
            })),
            // shared는 segment마다 index.ts (shared/ui/index.ts, shared/api/index.ts …)
            {
              from: { element: { types: { anyOf: LAYERS.slice(0, -1) } } },
              allow: {
                to: {
                  element: {
                    type: 'shared',
                    fileInternalPath: '*/index.{ts,tsx}',
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },

  // import 제한
  {
    files: [SRC],
    rules: {
      'no-restricted-imports': ['error', { paths: restricted() }],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'fetch는 api/ segment에서만 써요(shared/api의 http 클라이언트).',
        },
      ],
    },
  },
  {
    files: ['src/**/store/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: restricted('zustand') }],
    },
  },
  {
    files: ['src/**/model/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: restricted('nuqs') }],
    },
  },
  {
    files: ['src/**/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: restricted('createContext'), patterns: [SERVER_ONLY] },
      ],
    },
  },
  { files: ['src/**/api/**'], rules: { 'no-restricted-globals': 'off' } },
  {
    files: ['src/entities/*/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...restricted('createContext', 'useQuery'),
            { name: '@tanstack/react-query', message: PROPS_ONLY },
          ],
          patterns: [
            SERVER_ONLY,
            {
              group: [
                '../api',
                '../api/*',
                '../hooks',
                '../hooks/*',
                '../store',
                '../store/*',
              ],
              message: PROPS_ONLY,
            },
          ],
        },
      ],
    },
  },

  // TanStack Query: 공식 strict 규칙(prefer-query-options 포함)
  ...pluginQuery.configs['flat/recommended-strict'],

  // 로컬 규칙
  {
    files: [SRC],
    plugins: { sonic },
    rules: {
      'sonic/no-context-export': 'error',
      'sonic/store-selector': 'error',
      'sonic/server-only-guard': 'error',
    },
  },
  // import 정렬과 TypeScript 세부(harness.md 6절)
  {
    files: [SRC],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      // as는 쓰지 않아요(as const는 괜찮아요). 경계(api/, lib/, shared/, 테스트)만 아래에서 풀어요
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      'sonic/unknown-at-boundary': 'error',
      'sonic/no-enum': 'error',
      'sonic/no-direct-env': 'error',
    },
  },
  {
    files: ['src/**/api/**', 'src/**/lib/**', 'src/shared/**', TEST],
    rules: {
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
    },
  },
  {
    files: ['src/shared/config/**', 'src/shared/server/**'],
    rules: { 'sonic/no-direct-env': 'off' },
  },

  // Next.js 서버/클라이언트 경계: 'use client'는 ui/와 app/providers에만(harness.md 11절)
  {
    files: [SRC],
    ignores: ['src/**/ui/**', 'src/app/providers/**'],
    rules: { 'sonic/use-client-location': 'error' },
  },

  // 테스트 파일: 사용자 행동 중심 테스트(harness.md 7절)
  { files: [TEST], ...testingLibrary.configs['flat/react'] },
  {
    files: [TEST],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/valid-title': [
        'error',
        {
          mustMatch: {
            it: [TITLE, TITLE_MESSAGE],
            test: [TITLE, TITLE_MESSAGE],
          },
        },
      ],
      'testing-library/prefer-user-event': 'error',
      'sonic/no-test-id': 'error',
      'sonic/no-internal-mock': 'error',
    },
  },
);
