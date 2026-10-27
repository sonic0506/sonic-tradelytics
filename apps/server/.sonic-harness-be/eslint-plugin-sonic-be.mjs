// 하네스 로컬 ESLint 규칙이에요. 어떤 파일에 켜는지는 eslint.base.mjs가 정해요.
// TypeORM 수신 객체를 확인하는 규칙은 타입 정보(projectService)를 써요.

const HTTP_METHODS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete']);
const RELATIONS = new Set(['ManyToOne', 'OneToMany', 'OneToOne', 'ManyToMany']);
const DATE_COLUMNS = new Set([
  'CreateDateColumn',
  'UpdateDateColumn',
  'DeleteDateColumn',
]);
const NON_TZ_TYPES = new Set([
  'timestamp',
  'timestamp without time zone',
  'datetime',
]);
// repository 메서드 이름은 feature마다 달라서(rename, approve …) 조회 이름이 아니면 쓰기로 봐요.
const READ_METHOD = /^(find|count|exists|get|search|has|is|load|list)/;
const LOOP_METHODS = new Set(['map', 'forEach', 'flatMap', 'reduce', 'filter']);

const decoratorName = (decorator) => {
  const { expression } = decorator;
  const callee =
    expression.type === 'CallExpression' ? expression.callee : expression;
  return callee.type === 'Identifier' ? callee.name : null;
};
const decoratorArgs = (decorator) =>
  decorator.expression.type === 'CallExpression'
    ? decorator.expression.arguments
    : [];
const hasDecorator = (node, names) =>
  (node.decorators ?? []).some((d) => names.includes(decoratorName(d)));
const propertyName = (node) =>
  node.key?.type === 'Identifier' ? node.key.name : null;
const objectProperty = (object, name) =>
  object?.type === 'ObjectExpression'
    ? object.properties.find(
        (p) =>
          p.type === 'Property' &&
          !p.computed &&
          ((p.key.type === 'Identifier' && p.key.name === name) ||
            (p.key.type === 'Literal' && p.key.value === name)),
      )
    : undefined;
const memberName = (callee) =>
  callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
    ? callee.property.name
    : null;
// this.userRepository.xxx(...)
const isThisRepositoryCall = (node) => {
  const { callee } = node;
  return (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'MemberExpression' &&
    callee.object.object.type === 'ThisExpression' &&
    callee.object.property.type === 'Identifier' &&
    /Repository$/.test(callee.object.property.name)
  );
};

// 수신 객체의 타입 이름(Repository, EntityManager, SelectQueryBuilder …). 타입 정보가 없으면 null.
const typeName = (context, node) => {
  const services = context.sourceCode.parserServices;
  if (!services?.program) return null;
  const type = services.program
    .getTypeChecker()
    .getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));
  return (type.aliasSymbol ?? type.getSymbol())?.getName() ?? null;
};
const isQueryBuilder = (name) => /QueryBuilder$/.test(name ?? '');

const rule = (messages, create) => ({
  meta: { type: 'problem', messages, schema: [] },
  create,
});

// enum 대신 as const 객체·배열과 유니언 타입을 써요(런타임 코드가 생기지 않아요).
const noEnum = rule(
  {
    enum: "enum 대신 as const와 유니언 타입을 써요. 예: const ROLES = ['admin', 'user'] as const; type Role = (typeof ROLES)[number];",
  },
  (context) => ({
    TSEnumDeclaration(node) {
      context.report({ node, messageId: 'enum' });
    },
  }),
);

// 환경 변수는 src/config(env.ts)에서만 읽어요. 그 밖에서는 검증된 env를 써요.
const noDirectEnv = rule(
  {
    env: 'process.env를 직접 읽지 않아요. @/config의 검증된 env를 써요.',
  },
  (context) => ({
    MemberExpression(node) {
      const { object, property } = node;
      if (
        object.type === 'Identifier' &&
        object.name === 'process' &&
        property.type === 'Identifier' &&
        property.name === 'env'
      )
        context.report({ node, messageId: 'env' });
    },
  }),
);

// Service·Repository·Controller는 Nest DI로 받아요. 직접 new로 만들면 의존성과 트랜잭션 컨텍스트가 끊겨요.
const noManualInstantiation = rule(
  {
    instantiate:
      '{{name}}을(를) new로 만들지 않아요. 생성자 주입(constructor(private readonly x: {{name}}))으로 받아요.',
  },
  (context) => ({
    NewExpression(node) {
      const { callee } = node;
      if (
        callee.type === 'Identifier' &&
        /(Service|Repository|Controller)$/.test(callee.name)
      )
        context.report({
          node,
          messageId: 'instantiate',
          data: { name: callee.name },
        });
    },
  }),
);

// @Body()·@Query()로 통째로 받는 값은 *Dto 클래스예요. 그래야 ValidationPipe가 검증하고 Swagger에 나와요.
const dtoParamType = rule(
  {
    dto: '@{{decorator}}()로 받는 값은 class-validator가 붙은 *Dto 클래스로 받아요.',
  },
  (context) => ({
    'MethodDefinition > FunctionExpression'(fn) {
      for (const param of fn.params) {
        const target =
          param.type === 'TSParameterProperty' ? param.parameter : param;
        for (const d of param.decorators ?? []) {
          const name = decoratorName(d);
          if (!['Body', 'Query'].includes(name) || decoratorArgs(d).length)
            continue;
          const type = target.typeAnnotation?.typeAnnotation;
          const isDto =
            type?.type === 'TSTypeReference' &&
            type.typeName.type === 'Identifier' &&
            /Dto$/.test(type.typeName.name);
          if (!isDto)
            context.report({
              node: param,
              messageId: 'dto',
              data: { decorator: name },
            });
        }
      }
    },
  }),
);

// 컨트롤러 핸들러는 반환 타입을 *Dto(또는 Promise<*Dto>, *Dto[], PageDto<*Dto>, void)로 적어요.
// Entity를 그대로 돌려주면 민감한 컬럼이 응답에 섞이고 Swagger 스키마도 비어요.
const isDtoType = (node) => {
  if (!node) return false;
  if (node.type === 'TSVoidKeyword') return true;
  if (node.type === 'TSArrayType') return isDtoType(node.elementType);
  if (node.type !== 'TSTypeReference' || node.typeName.type !== 'Identifier')
    return false;
  const { name } = node.typeName;
  const args = node.typeArguments?.params ?? [];
  if (name === 'Promise' || name === 'Array') return args.every(isDtoType);
  // 프레임워크가 형식을 정한 응답(파일, health check)은 그대로 둬요.
  if (['StreamableFile', 'HealthCheckResult'].includes(name)) return true;
  return /Dto$/.test(name) && args.every(isDtoType);
};
const handlerReturnDto = rule(
  {
    missing:
      '핸들러 {{name}}의 반환 타입을 적어요. 예: Promise<UserResponseDto>. Swagger 응답 스키마가 이 타입으로 만들어져요.',
    notDto:
      '핸들러 {{name}}은(는) *Dto를 돌려줘요(Entity·원시값 금지). 응답 DTO의 static from(entity)로 바꿔서 돌려줘요.',
  },
  (context) => ({
    MethodDefinition(node) {
      if (!hasDecorator(node, [...HTTP_METHODS])) return;
      const name = propertyName(node) ?? '(이름 없음)';
      const returnType = node.value.returnType?.typeAnnotation;
      if (!returnType)
        context.report({
          node: node.key,
          messageId: 'missing',
          data: { name },
        });
      else if (!isDtoType(returnType))
        context.report({
          node: returnType,
          messageId: 'notDto',
          data: { name },
        });
    },
  }),
);

// 비즈니스 예외는 AppException을 상속한 feature 예외로 던져요. new Error는 전역 필터가 500으로 바꿔요.
const noGenericError = rule(
  {
    generic:
      'new Error 대신 AppException을 상속한 예외(예: user.exception.ts의 UserNotFoundException)를 던져요.',
  },
  (context) => ({
    'ThrowStatement > NewExpression'(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'Error')
        context.report({ node, messageId: 'generic' });
    },
  }),
);

// 목록 조회는 take로 개수를 제한해요(페이지네이션). findBy·findAndCountBy는 take를 받지 않아 쓰지 않아요.
const chainHasTake = (node) => {
  let current = node;
  while (
    current?.type === 'CallExpression' ||
    current?.type === 'MemberExpression'
  ) {
    if (current.type === 'CallExpression') {
      if (['take', 'limit'].includes(memberName(current.callee))) return true;
      current = current.callee;
    } else current = current.object;
  }
  return false;
};
const requireFindTake = rule(
  {
    take: '{{method}}에 take를 넣어 개수를 제한해요. 목록은 PageQueryDto의 size를 넘겨요.',
    by: '{{method}}는 take를 받지 않아요. find({ where, take })로 써요.',
    chain:
      '{{method}}() 앞 같은 체인에 .take()를 넣어요. 다른 문장에서 넣은 take는 확인할 수 없어요.',
  },
  (context) => ({
    CallExpression(node) {
      const method = memberName(node.callee);
      if (!method) return;
      const receiver = node.callee.object;
      if (['getMany', 'getManyAndCount', 'getRawMany'].includes(method)) {
        if (
          isQueryBuilder(typeName(context, receiver)) &&
          !chainHasTake(receiver)
        )
          context.report({ node, messageId: 'chain', data: { method } });
        return;
      }
      if (
        !['find', 'findAndCount', 'findBy', 'findAndCountBy'].includes(method)
      )
        return;
      const owner = typeName(context, receiver);
      if (!['Repository', 'EntityManager'].includes(owner)) return;
      if (method.endsWith('By')) {
        context.report({ node, messageId: 'by', data: { method } });
        return;
      }
      const options = node.arguments[owner === 'EntityManager' ? 1 : 0];
      if (!objectProperty(options, 'take'))
        context.report({ node, messageId: 'take', data: { method } });
    },
  }),
);

// SQL에 값을 문자열로 이어 붙이지 않아요(SQL injection). 파라미터(:name, $1)로 넘겨요.
const SQL_METHODS = new Set([
  'where',
  'andWhere',
  'orWhere',
  'having',
  'andHaving',
  'orHaving',
]);
const isInterpolated = (node) =>
  (node?.type === 'TemplateLiteral' && node.expressions.length > 0) ||
  (node?.type === 'BinaryExpression' &&
    node.operator === '+' &&
    [node.left, node.right].some(
      (side) => side.type !== 'Literal' || isInterpolated(side),
    ));
const noRawSqlInterpolation = rule(
  {
    interpolated:
      '{{method}}()에 값을 문자열로 이어 붙이지 않아요. 파라미터로 넘겨요: where("user.name = :name", { name }), query("... $1", [id]).',
  },
  (context) => ({
    CallExpression(node) {
      const method = memberName(node.callee);
      if (!isInterpolated(node.arguments[0])) return;
      const owner = typeName(context, node.callee.object);
      const isRaw =
        method === 'query' &&
        ['Repository', 'EntityManager', 'DataSource', 'QueryRunner'].includes(
          owner,
        );
      const isBuilder = SQL_METHODS.has(method) && isQueryBuilder(owner);
      if (isRaw || isBuilder)
        context.report({ node, messageId: 'interpolated', data: { method } });
    },
  }),
);

// synchronize는 운영 DB 스키마를 몰래 바꿔요. 스키마 변경은 migration으로만 해요.
const noSynchronize = rule(
  {
    sync: 'synchronize는 켜지 않아요. 스키마 변경은 npm run migration:generate로 migration을 만들어요.',
  },
  (context) => ({
    Property(node) {
      const isSync =
        !node.computed &&
        node.key.type === 'Identifier' &&
        node.key.name === 'synchronize';
      if (
        isSync &&
        !(node.value.type === 'Literal' && node.value.value === false)
      )
        context.report({ node, messageId: 'sync' });
    },
  }),
);

// eager·lazy relation은 보이지 않는 쿼리를 만들어 N+1을 숨겨요. relations·leftJoinAndSelect로 명시해요.
const noEagerLazyRelation = rule(
  {
    eager:
      '{{option}} relation은 쓰지 않아요. 필요한 곳에서 relations: { x: true } 또는 leftJoinAndSelect로 불러와요.',
  },
  (context) => ({
    PropertyDefinition(node) {
      const relation = (node.decorators ?? []).find((d) =>
        RELATIONS.has(decoratorName(d)),
      );
      if (!relation) return;
      for (const arg of decoratorArgs(relation))
        for (const option of ['eager', 'lazy']) {
          const prop = objectProperty(arg, option);
          if (prop?.value.type === 'Literal' && prop.value.value === true)
            context.report({
              node: prop,
              messageId: 'eager',
              data: { option },
            });
        }
      const type = node.typeAnnotation?.typeAnnotation;
      if (
        type?.type === 'TSTypeReference' &&
        type.typeName.type === 'Identifier' &&
        type.typeName.name === 'Promise'
      )
        context.report({
          node: type,
          messageId: 'eager',
          data: { option: 'lazy' },
        });
    },
  }),
);

// 시각 컬럼은 timestamptz로 저장해요(서버·DB 시간대가 달라도 같은 시각). 날짜만은 'date'를 써요.
const timestamptzOnly = rule(
  {
    tz: "시각 컬럼은 type: 'timestamptz'로 적어요. 날짜만 저장하면 type: 'date'예요.",
  },
  (context) => ({
    PropertyDefinition(node) {
      for (const d of node.decorators ?? []) {
        const name = decoratorName(d);
        const args = decoratorArgs(d);
        if (DATE_COLUMNS.has(name)) {
          const type = objectProperty(args[0], 'type');
          if (type?.value.value !== 'timestamptz')
            context.report({ node: d, messageId: 'tz' });
        } else if (name === 'Column') {
          const typeValue =
            args[0]?.type === 'Literal'
              ? args[0].value
              : objectProperty(args[0], 'type')?.value.value;
          const annotation = node.typeAnnotation?.typeAnnotation;
          const isDateProperty =
            annotation?.type === 'TSTypeReference' &&
            annotation.typeName.type === 'Identifier' &&
            annotation.typeName.name === 'Date';
          if (
            NON_TZ_TYPES.has(typeValue) ||
            (typeValue === undefined && isDateProperty)
          )
            context.report({ node: d, messageId: 'tz' });
        }
      }
    },
  }),
);

// 한 메서드에서 두 번 이상 쓰면 @Transactional()로 묶었는지 확인해요. 휴리스틱이라 warn으로 켜요.
const transactionalWrites = rule(
  {
    tx: '{{name}}에서 저장·수정·삭제를 {{count}}번 해요. 함께 성공·실패해야 하면 @Transactional()을 붙이고, 아니면 이유를 주석으로 남겨요.',
  },
  (context) => {
    const stack = [];
    return {
      MethodDefinition() {
        stack.push(0);
      },
      CallExpression(node) {
        if (
          stack.length &&
          isThisRepositoryCall(node) &&
          !READ_METHOD.test(memberName(node.callee))
        )
          stack[stack.length - 1]++;
      },
      'MethodDefinition:exit'(node) {
        const count = stack.pop();
        if (count >= 2 && !hasDecorator(node, ['Transactional']))
          context.report({
            node: node.key,
            messageId: 'tx',
            data: { name: propertyName(node) ?? '메서드', count },
          });
      },
    };
  },
);

// 반복 콜백 안에서 repository를 부르면 항목 수만큼 쿼리가 나가요(N+1). In(ids)로 한 번에 가져와요.
const noRepositoryCallInLoop = rule(
  {
    loop: '{{method}} 콜백 안에서 repository를 부르지 않아요(N+1). find({ where: { id: In(ids) }, take })처럼 한 번에 가져와요.',
  },
  (context) => ({
    CallExpression(node) {
      if (!isThisRepositoryCall(node)) return;
      const ancestors = context.sourceCode.getAncestors(node);
      for (let i = ancestors.length - 1; i > 0; i--) {
        const fn = ancestors[i];
        const parent = ancestors[i - 1];
        if (
          ['ArrowFunctionExpression', 'FunctionExpression'].includes(fn.type) &&
          parent.type === 'CallExpression' &&
          parent.arguments.includes(fn) &&
          LOOP_METHODS.has(memberName(parent.callee))
        ) {
          context.report({
            node,
            messageId: 'loop',
            data: { method: memberName(parent.callee) },
          });
          return;
        }
      }
    },
  }),
);

// 테스트에서 프로젝트 모듈을 vi.mock으로 바꾸지 않아요. service 단위 테스트는 repository만
// Test.createTestingModule().overrideProvider로 바꾸고, 외부 HTTP는 MSW로 바꿔요.
const noInternalMock = rule(
  {
    internal:
      "프로젝트 모듈('{{path}}')을 vi.mock으로 바꾸지 않아요. repository는 overrideProvider로, 외부 HTTP는 MSW로 바꿔요.",
  },
  (context) => ({
    CallExpression(node) {
      const { callee } = node;
      const [first] = node.arguments;
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'vi' &&
        ['mock', 'doMock'].includes(memberName(callee)) &&
        first?.type === 'Literal' &&
        /^(@\/|\.)/.test(String(first.value))
      )
        context.report({
          node,
          messageId: 'internal',
          data: { path: first.value },
        });
    },
  }),
);

// 업로드 파일은 ParseFilePipe로 크기·형식을 검증해요.
const uploadedFilePipe = rule(
  {
    pipe: '@{{name}}()에 ParseFilePipe(MaxFileSizeValidator, FileTypeValidator)를 넘겨 크기·형식을 검증해요.',
  },
  (context) => ({
    Decorator(node) {
      const name = decoratorName(node);
      if (!['UploadedFile', 'UploadedFiles'].includes(name)) return;
      const hasPipe = decoratorArgs(node).some((arg) =>
        context.sourceCode.getText(arg).includes('ParseFilePipe'),
      );
      if (!hasPipe) context.report({ node, messageId: 'pipe', data: { name } });
    },
  }),
);

// 요청 DTO에서 이름이 *Code인 필드는 공통 코드인지 아닌지 데코레이터로 밝혀요.
// 공통 코드면 @IsCommonCode(group), 아니면 @NotCommonCode(). 응답 DTO(*ResponseDto)는 검사하지 않아요.
const codeFieldExplicit = rule(
  {
    explicit:
      '{{name}}: 공통 코드면 @IsCommonCode(그룹), 아니면 @NotCommonCode()를 붙여요(harness.md 12절).',
  },
  (context) => ({
    PropertyDefinition(node) {
      const name = propertyName(node);
      const className = node.parent.parent.id?.name ?? '';
      if (!name || !/Code$/.test(name) || /ResponseDto$/.test(className))
        return;
      if (!hasDecorator(node, ['IsCommonCode', 'NotCommonCode']))
        context.report({
          node: node.key,
          messageId: 'explicit',
          data: { name },
        });
    },
  }),
);

// 검증기에서 예외를 잡아 false로 바꾸면 DB 장애가 "잘못된 값(400)"으로 보여요. 예외는 그대로 던져요.
const validatorNoSwallow = rule(
  {
    swallow:
      '검증기에서 예외를 잡아 false를 돌려주지 않아요. DB 장애는 그대로 던져 500(시스템 예외)으로 처리돼야 해요.',
  },
  (context) => ({
    'CatchClause ReturnStatement'(node) {
      if (node.argument?.type === 'Literal' && node.argument.value === false)
        context.report({ node, messageId: 'swallow' });
    },
  }),
);

// 통합 API(compositions) 하나가 너무 많은 feature에 기대면 화면 단위로 나눠요.
const MAX_COMPOSITION_DEPS = 5;
const compositionMaxDeps = rule(
  {
    many:
      '이 파일이 feature {{count}}개를 가져와요(최대 ' +
      MAX_COMPOSITION_DEPS +
      '개). 화면이나 유스케이스 단위로 통합 API를 나눠요.',
  },
  (context) => ({
    Program(node) {
      const features = new Set(
        node.body
          .filter((n) => n.type === 'ImportDeclaration')
          .map((n) => /^@\/modules\/([^/]+)/.exec(n.source.value)?.[1])
          .filter(Boolean),
      );
      if (features.size > MAX_COMPOSITION_DEPS)
        context.report({
          node,
          messageId: 'many',
          data: { count: features.size },
        });
    },
  }),
);

export default {
  meta: { name: 'sonic-be' },
  rules: {
    'no-enum': noEnum,
    'no-direct-env': noDirectEnv,
    'no-manual-instantiation': noManualInstantiation,
    'dto-param-type': dtoParamType,
    'handler-return-dto': handlerReturnDto,
    'no-generic-error': noGenericError,
    'require-find-take': requireFindTake,
    'no-raw-sql-interpolation': noRawSqlInterpolation,
    'no-synchronize': noSynchronize,
    'no-eager-lazy-relation': noEagerLazyRelation,
    'timestamptz-only': timestamptzOnly,
    'transactional-writes': transactionalWrites,
    'no-repository-call-in-loop': noRepositoryCallInLoop,
    'no-internal-mock': noInternalMock,
    'uploaded-file-pipe': uploadedFilePipe,
    'code-field-explicit': codeFieldExplicit,
    'validator-no-swallow': validatorNoSwallow,
    'composition-max-deps': compositionMaxDeps,
  },
};
