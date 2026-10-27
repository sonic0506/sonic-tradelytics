// 하네스 로컬 ESLint 규칙이에요. AST 패턴이 필요한 규칙은 no-restricted-syntax 대신 여기에 둬요
// (no-restricted-syntax는 sonic-ui 디자인 규칙이 쓰고 있어서, 같이 켜면 서로 덮어써요).

const isIndexFile = (filename) => /[\\/]index\.tsx?$/.test(filename);

// slice의 public API(index.ts)로 Context를 내보내지 않아요.
// Context는 묶인 컴포넌트 내부 전달용이라, 밖에서는 그 컴포넌트만 써요.
const noContextExport = {
  meta: {
    type: 'problem',
    messages: {
      exported:
        '{{name}}을(를) index.ts로 내보내지 않아요. Context는 묶인 컴포넌트 내부 전달용이에요. 밖에는 컴포넌트만 내보내요.',
    },
    schema: [],
  },
  create(context) {
    if (!isIndexFile(context.filename)) return {};
    const check = (node, name) => {
      if (/Context$/.test(name))
        context.report({ node, messageId: 'exported', data: { name } });
    };
    return {
      ExportSpecifier(node) {
        check(node, node.exported.name ?? node.exported.value);
      },
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(
        node,
      ) {
        if (node.id.type === 'Identifier') check(node, node.id.name);
      },
    };
  },
};

// Zustand store는 selector로 필요한 값만 구독해요. 인자 없이 부르면 store 전체가 바뀔 때마다 다시 그려요.
const storeSelector = {
  meta: {
    type: 'problem',
    messages: {
      noSelector:
        '{{name}}()처럼 store 전체를 구독하지 않아요. {{name}}((s) => s.필요한값)처럼 selector로 필요한 값만 꺼내요.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'Identifier' &&
          /^use[A-Z]\w*Store$/.test(callee.name) &&
          node.arguments.length === 0
        )
          context.report({
            node,
            messageId: 'noSelector',
            data: { name: callee.name },
          });
      },
    };
  },
};

// 테스트: 요소는 역할·라벨·글자로 찾아요. data-testid는 사용자가 보지 않는 값이라 쓰지 않아요.
const noTestId = {
  meta: {
    type: 'problem',
    messages: {
      testId:
        '{{name}}는 쓰지 않아요. getByRole → getByLabelText → getByText 순서로, 사용자가 보는 것으로 찾아요.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        const name =
          callee.type === 'MemberExpression'
            ? callee.property.name
            : callee.name;
        if (/^(get|query|find)(All)?ByTestId$/.test(name ?? ''))
          context.report({ node, messageId: 'testId', data: { name } });
      },
    };
  },
};

// 테스트: 프로젝트 모듈을 vi.mock으로 바꾸지 않아요. 서버 응답은 MSW(server.use)로 바꿔요.
const noInternalMock = {
  meta: {
    type: 'problem',
    messages: {
      internal:
        "프로젝트 모듈('{{path}}')을 vi.mock으로 바꾸지 않아요. 서버 응답은 server.use(http.get(...))로 바꾸고, 나머지는 실제 코드로 테스트해요.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        const [first] = node.arguments;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.name === 'vi' &&
          ['mock', 'doMock'].includes(callee.property.name) &&
          first?.type === 'Literal' &&
          /^(@\/|\.)/.test(first.value)
        )
          context.report({
            node,
            messageId: 'internal',
            data: { path: first.value },
          });
      },
    };
  },
};

// Next.js: 'use client'는 상호작용이 있는 ui/ 컴포넌트와 app/providers에만 둬요.
// 화면(pages·widgets) 파일은 서버 컴포넌트로 두고, 상호작용 부분만 ui/로 떼어 내요.
// 허용 위치는 eslint.base.mjs에서 이 규칙을 끄는 ignores로 정해요.
const useClientLocation = {
  meta: {
    type: 'problem',
    messages: {
      location:
        "'use client'는 상호작용이 있는 ui/ 컴포넌트(또는 app/providers)에만 써요. 이 파일은 서버 컴포넌트로 두고, 상호작용 부분을 ui/ 컴포넌트로 떼어 내요.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const directive = node.body.find(
          (n) =>
            n.type === 'ExpressionStatement' && n.directive === 'use client',
        );
        if (directive)
          context.report({ node: directive, messageId: 'location' });
      },
    };
  },
};

// Next.js: *.server.ts(x)는 서버 전용이에요. import 'server-only'로 시작해서
// 클라이언트 번들에 들어가면 빌드가 실패하게 해요(비밀 키가 새지 않게).
const serverOnlyGuard = {
  meta: {
    type: 'problem',
    messages: {
      missing:
        "서버 전용 파일(*.server.ts)은 맨 위에 import 'server-only';를 넣어요. 클라이언트에서 불러오면 빌드가 실패해서 비밀 값이 새지 않아요.",
    },
    schema: [],
  },
  create(context) {
    if (!/\.server\.tsx?$/.test(context.filename)) return {};
    return {
      Program(node) {
        const hasGuard = node.body.some(
          (n) =>
            n.type === 'ImportDeclaration' && n.source.value === 'server-only',
        );
        if (!hasGuard) context.report({ node, messageId: 'missing' });
      },
    };
  },
};

// TypeScript: unknown은 외부 값을 받는 경계에서만 써요. 그 밖에서는 zod 스키마나 구체 타입으로 좁혀서 넘겨요.
const BOUNDARY =
  /[\\/](api|lib)[\\/]|[\\/]model[\\/][^\\/]+\.schema\.tsx?$|[\\/]shared[\\/](config|server)[\\/]|\.test\.tsx?$/;
const unknownAtBoundary = {
  meta: {
    type: 'problem',
    messages: {
      unknown:
        'unknown은 외부 값을 받는 경계(api/, model/*.schema.ts, lib/의 파서, catch)에서만 써요. 여기서는 zod 스키마나 구체 타입으로 좁힌 값을 받아요.',
    },
    schema: [],
  },
  create(context) {
    if (BOUNDARY.test(context.filename)) return {};
    return {
      TSUnknownKeyword(node) {
        const inCatch = context.sourceCode
          .getAncestors(node)
          .some((a) => a.type === 'CatchClause');
        if (!inCatch) context.report({ node, messageId: 'unknown' });
      },
    };
  },
};

// TypeScript: enum 대신 as const 객체 + 유니언 타입을 써요(런타임 코드가 생기지 않아요).
const noEnum = {
  meta: {
    type: 'problem',
    messages: {
      enum: "enum 대신 as const 객체와 유니언 타입을 써요. 예: const ROLE = { admin: 'admin' } as const; type Role = (typeof ROLE)[keyof typeof ROLE];",
    },
    schema: [],
  },
  create(context) {
    return {
      TSEnumDeclaration(node) {
        context.report({ node, messageId: 'enum' });
      },
    };
  },
};

// 환경 변수: process.env·import.meta.env는 shared/config(env.ts)에서만 읽어요. 그 밖에서는 검증된 env를 써요.
const noDirectEnv = {
  meta: {
    type: 'problem',
    messages: {
      env: '환경 변수를 직접 읽지 않아요. @/shared/config의 env(서버 전용 값은 @/shared/server의 serverEnv)를 써요.',
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        const { object, property } = node;
        const name = property.type === 'Identifier' ? property.name : null;
        const isProcessEnv =
          object.type === 'Identifier' &&
          object.name === 'process' &&
          name === 'env';
        const isImportMetaEnv =
          object.type === 'MetaProperty' && name === 'env';
        if (isProcessEnv || isImportMetaEnv)
          context.report({ node, messageId: 'env' });
      },
    };
  },
};

export default {
  meta: { name: 'sonic' },
  rules: {
    'no-context-export': noContextExport,
    'store-selector': storeSelector,
    'no-test-id': noTestId,
    'no-internal-mock': noInternalMock,
    'use-client-location': useClientLocation,
    'server-only-guard': serverOnlyGuard,
    'unknown-at-boundary': unknownAtBoundary,
    'no-enum': noEnum,
    'no-direct-env': noDirectEnv,
  },
};
