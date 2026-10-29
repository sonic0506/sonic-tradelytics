// 하네스 공통 ESLint 규칙. 프로젝트에서는 .sonic-harness-be/eslint.base.mjs로 들어가요.
// 설명과 예시는 harness.md에 있어요. 이 프로젝트만의 규칙은 프로젝트 eslint.config.mjs에 둬요.
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import boundaries from 'eslint-plugin-boundaries';
import checkFile from 'eslint-plugin-check-file';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import sonicBe from './eslint-plugin-sonic-be.mjs';

const SRC = 'src/**/*.ts';
const SPEC = ['src/**/*.spec.ts', 'test/**/*.ts'];
// 테스트 이름은 해요체 문장이에요: it('이름이 비어 있으면 400을 돌려줘요')
const TITLE = '요[.!?]?$';
const TITLE_MESSAGE = "테스트 이름은 '~하면 ~해요'처럼 해요체 문장으로 써요.";

// ── Feature-Based + Layered 경계 ──────────────────────────────────────────
// src/modules/{feature}/의 파일은 접미사로 레이어가 정해져요. 목록에 없는 파일은 no-unknown-files로 막아요.
const FEATURE_FILES = {
  'feature-index': 'index.ts',
  module: '*.module.ts',
  controller: '*.controller.ts',
  service: '*.service.ts',
  repository: '*.repository.ts',
  exception: '*.exception.ts',
  validator: '*.validator.ts',
  // 순수 규칙 함수(판단·계산). Nest·DB·시계 없이 입력만으로 결과를 내요
  rule: '*.rule.ts',
  model: '*.{constants,types}.ts',
  dto: 'dto/*.dto.ts',
  entity: 'entities/*.entity.ts',
};
// src/compositions/{screen}/: 여러 feature를 조합하는 통합 API. repository·entity는 둘 수 없어요.
const COMPOSITION_FILES = {
  'composition-module': '*.module.ts',
  'composition-controller': '*.controller.ts',
  'composition-service': '*.service.ts',
  'composition-dto': 'dto/*.dto.ts',
};
// ponytail: mode: 'file'은 boundaries v7에서 deprecated라 실행할 때 경고가 한 줄 나와요. file descriptor로는
// "목록에 없는 파일 금지"(no-unknown-files)가 안 돼서 이걸 써요. v8에서 없어지면 그때 옮겨요.
const fileElement = (type, pattern) => ({
  type,
  pattern,
  mode: 'file',
  capture: ['feature'],
});
const ELEMENTS = [
  ...Object.entries(FEATURE_FILES).map(([type, file]) =>
    fileElement(type, `src/modules/*/${file}`),
  ),
  ...Object.entries(COMPOSITION_FILES).map(([type, file]) =>
    fileElement(type, `src/compositions/*/${file}`),
  ),
  { type: 'app', pattern: 'src/*.ts', mode: 'file' },
  { type: 'common', pattern: 'src/common' },
  { type: 'config', pattern: 'src/config' },
  { type: 'infra', pattern: 'src/infra' },
];

// 누가 무엇을 가져올 수 있는지. same(x)는 같은 feature(또는 같은 composition)의 x예요.
// 다른 feature는 'feature-index'(그 feature의 index.ts)로만 가져와요.
const same = (type) => ({
  type,
  captured: { feature: '{{ from.element.captured.feature }}' },
});
const ANY_INDEX = { type: 'feature-index' };
const COMMON = { type: 'common' };
const CONFIG = { type: 'config' };
const INFRA = { type: 'infra' };
const ALLOWED = {
  // controller → exception은 Swagger 문서(@ApiErrors)용이에요. 던지는 곳은 service예요.
  controller: [
    same('service'),
    same('dto'),
    same('exception'),
    same('model'),
    COMMON,
    CONFIG,
  ],
  service: [
    same('service'),
    same('repository'),
    same('dto'),
    same('entity'),
    same('exception'),
    same('rule'),
    same('model'),
    ANY_INDEX,
    COMMON,
    CONFIG,
    INFRA,
  ],
  repository: [same('entity'), same('model'), COMMON, CONFIG, INFRA],
  dto: [same('dto'), same('entity'), same('model'), ANY_INDEX, COMMON],
  entity: [same('entity'), same('model'), ANY_INDEX, COMMON],
  // 다른 feature의 예외를 다시 내보낼 때만 그 index.ts를 가져와요(그 service가 던져 이 API까지 오는 예외, @ApiErrors용).
  exception: [same('model'), ANY_INDEX, COMMON],
  validator: [same('service'), same('model'), COMMON],
  // rule은 같은 feature의 constants·types와 다른 rule, common만 가져와요. service가 rule을 불러요
  rule: [same('rule'), same('model'), COMMON],
  model: [same('model'), COMMON],
  module: [
    same('controller'),
    same('service'),
    same('repository'),
    same('entity'),
    same('validator'),
    same('model'),
    ANY_INDEX,
    COMMON,
    CONFIG,
    INFRA,
  ],
  'feature-index': Object.keys(FEATURE_FILES).map(same),
  'composition-module': [
    same('composition-controller'),
    same('composition-service'),
    ANY_INDEX,
    COMMON,
    CONFIG,
  ],
  'composition-controller': [
    same('composition-service'),
    same('composition-dto'),
    COMMON,
    CONFIG,
  ],
  'composition-service': [same('composition-dto'), ANY_INDEX, COMMON, CONFIG],
  'composition-dto': [same('composition-dto'), ANY_INDEX, COMMON],
  app: [
    { type: 'app' },
    ANY_INDEX,
    { type: 'composition-module' },
    COMMON,
    CONFIG,
    INFRA,
  ],
  common: [COMMON, CONFIG],
  config: [CONFIG],
  infra: [INFRA, CONFIG, COMMON],
};
const POLICIES = [
  { allow: { to: { module: { origin: 'external' } } } },
  { allow: { to: { module: { origin: 'core' } } } },
  ...Object.entries(ALLOWED).flatMap(([from, targets]) =>
    targets.map((to) => ({
      from: { element: { type: from } },
      allow: { to: { element: to } },
    })),
  ),
  // composition controller는 다른 feature의 응답 DTO를 타입으로만 써요(import type). service 호출은 composition service로 해요.
  {
    from: { element: { type: 'composition-controller' } },
    allow: { to: { element: ANY_INDEX }, dependency: { kind: 'type' } },
  },
];

// ── import 제한 ──────────────────────────────────────────────────────────
// 위치마다 풀어 주는 항목이 달라서 이름으로 묶고 restricted()로 조합해요
// (flat config에서는 같은 규칙의 옵션이 합쳐지지 않고 덮어써져요).
const HTTP_EXCEPTIONS = [
  'HttpException',
  'BadRequestException',
  'UnauthorizedException',
  'ForbiddenException',
  'NotFoundException',
  'ConflictException',
  'GoneException',
  'UnprocessableEntityException',
  'InternalServerErrorException',
  'ServiceUnavailableException',
];
const TYPEORM_MESSAGE =
  'TypeORM은 repository·entity·module·infra에서만 써요. 데이터는 같은 feature의 repository 메서드로 다뤄요.';
const RESTRICTED = {
  typeorm: { name: 'typeorm', message: TYPEORM_MESSAGE },
  nestTypeorm: { name: '@nestjs/typeorm', message: TYPEORM_MESSAGE },
  httpExceptions: {
    name: '@nestjs/common',
    importNames: HTTP_EXCEPTIONS,
    message:
      'HTTP 예외는 controller와 common(필터·guard)에서만 써요. 비즈니스 예외는 AppException을 상속한 feature 예외(*.exception.ts)로 던져요.',
  },
  forwardRef: {
    name: '@nestjs/common',
    importNames: ['forwardRef'],
    message:
      'forwardRef는 순환 의존을 가려요. 의존 방향을 바꾸거나 공통 부분을 다른 feature로 옮겨요.',
  },
};
const restricted = (...allowed) =>
  Object.entries(RESTRICTED)
    .filter(([key]) => !allowed.includes(key))
    .map(([, path]) => path);

export default tseslint.config(
  // migration은 TypeORM이 만든 코드라 검사하지 않아요(파일 이름도 타임스탬프로 시작해요).
  { ignores: ['dist', 'coverage', 'src/infra/database/migrations/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  eslintComments.recommended,
  { languageOptions: { globals: globals.node } },
  {
    // 규칙을 끄는 주석에는 이유를 적어요: // eslint-disable-next-line x -- 이유
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },

  // 이름 규칙
  {
    files: [SRC],
    plugins: { 'check-file': checkFile },
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      // consistent-type-imports는 쓰지 않아요. 생성자 주입 타입을 import type으로 바꾸면
      // 데코레이터 메타데이터가 사라져 Nest DI가 실패해요.
      'check-file/filename-naming-convention': [
        'error',
        { 'src/**/*.ts': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': [
        'error',
        { 'src/**/': 'KEBAB_CASE' },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        // 데코레이터는 const로도 만들어요: export const Public = () => SetMetadata(...)
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
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

  // Feature·Layer 경계(harness.md 1절)
  {
    files: [SRC],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/include': ['src/**/*.ts'],
      'boundaries/ignore': ['src/**/*.spec.ts'],
      'boundaries/elements': ELEMENTS,
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            '{{from.element.type}} → {{to.element.type}} import는 안 돼요. 레이어는 controller → service → repository 방향이고, 다른 feature는 그 index.ts로만 가져와요(harness.md 1절).',
          policies: POLICIES,
        },
      ],
    },
  },

  // import 제한
  {
    files: [SRC],
    rules: { 'no-restricted-imports': ['error', { paths: restricted() }] },
  },
  {
    files: [
      'src/**/*.repository.ts',
      'src/**/*.entity.ts',
      'src/**/*.module.ts',
      'src/infra/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: restricted('typeorm', 'nestTypeorm') },
      ],
    },
  },
  {
    files: ['src/**/*.controller.ts', 'src/common/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: restricted('httpExceptions') },
      ],
    },
  },

  // import 정렬과 TypeScript 세부
  {
    files: [SRC],
    plugins: { 'simple-import-sort': simpleImportSort, 'sonic-be': sonicBe },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-console': 'error',
      'no-await-in-loop': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      // as는 쓰지 않아요(as const는 괜찮아요).
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      'sonic-be/no-enum': 'error',
      'sonic-be/no-direct-env': 'error',
      'sonic-be/no-manual-instantiation': 'error',
      'sonic-be/no-synchronize': 'error',
      'sonic-be/no-raw-sql-interpolation': 'error',
    },
  },
  { files: ['src/config/**'], rules: { 'sonic-be/no-direct-env': 'off' } },

  // 매직 넘버: 이름 있는 상수로 빼요. DTO·entity의 검증·컬럼 길이(@Max(100), length: 50)는 예외예요.
  {
    files: [SRC],
    ignores: [
      ...SPEC,
      'src/**/*.dto.ts',
      'src/**/*.entity.ts',
      'src/config/**',
    ],
    rules: {
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, -1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
    },
  },

  // 레이어별 규칙
  {
    files: ['src/modules/**/*.ts', 'src/compositions/**/*.ts'],
    ignores: SPEC,
    rules: { 'sonic-be/no-generic-error': 'error' },
  },
  {
    files: ['src/**/*.controller.ts'],
    rules: {
      'sonic-be/dto-param-type': 'error',
      'sonic-be/handler-return-dto': 'error',
      'sonic-be/uploaded-file-pipe': 'error',
    },
  },
  {
    files: ['src/**/*.service.ts'],
    rules: {
      'sonic-be/transactional-writes': 'warn',
      'sonic-be/no-repository-call-in-loop': 'error',
    },
  },
  {
    files: ['src/**/*.repository.ts'],
    rules: { 'sonic-be/require-find-take': 'error' },
  },
  {
    files: ['src/**/*.entity.ts'],
    rules: {
      'sonic-be/timestamptz-only': 'error',
      'sonic-be/no-eager-lazy-relation': 'error',
    },
  },
  {
    files: ['src/**/*.dto.ts'],
    rules: { 'sonic-be/code-field-explicit': 'error' },
  },
  {
    files: ['src/**/*.validator.ts'],
    rules: { 'sonic-be/validator-no-swallow': 'error' },
  },
  // rule은 순수 함수예요. 같은 입력이면 같은 결과가 나와야 백테스트·테스트가 Nest 없이 그대로 불러요.
  // 시각은 인자(snapshot)로 받아요.
  {
    files: ['src/**/*.rule.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restricted(),
          patterns: [
            {
              group: [
                '@nestjs/*',
                '@nestjs-cls/*',
                'nestjs-*',
                'typeorm',
                'node:*',
              ],
              message:
                'rule은 순수 함수예요. Nest·DB·Node API를 쓰는 일은 같은 feature의 service에서 하고, 결과만 인자로 넘겨요.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'rule은 시계를 읽지 않아요. 지금 시각은 인자로 받아요.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'rule은 시계를 읽지 않아요. 지금 시각은 인자로 받아요.',
        },
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'rule은 같은 입력이면 같은 결과를 내요. 난수는 인자로 받아요.',
        },
      ],
    },
  },
  {
    files: ['src/compositions/**/*.ts'],
    rules: { 'sonic-be/composition-max-deps': 'warn' },
  },

  // 테스트(harness.md 7절)
  {
    files: SPEC,
    plugins: { vitest, 'sonic-be': sonicBe },
    languageOptions: { globals: vitest.environments.env.globals },
    rules: {
      ...vitest.configs.recommended.rules,
      // supertest의 .expect(201)도 검증으로 봐요.
      'vitest/expect-expect': [
        'error',
        // supertest .expect(...)는 request(...)로 바로 부르든 도우미(create(...).expect)로 부르든 단언이에요.
        {
          assertFunctionNames: [
            'expect',
            'request.**.expect',
            '*.expect',
            '*.**.expect',
          ],
        },
      ],
      'vitest/valid-title': [
        'error',
        {
          mustMatch: {
            it: [TITLE, TITLE_MESSAGE],
            test: [TITLE, TITLE_MESSAGE],
          },
        },
      ],
      'sonic-be/no-internal-mock': 'error',
      'no-restricted-imports': 'off',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
    },
  },
);
