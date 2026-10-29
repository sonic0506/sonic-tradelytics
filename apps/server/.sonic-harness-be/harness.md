# 코딩 하네스 (sonic-harness-be)

NestJS 12(ESM) + TypeORM + PostgreSQL + Vitest 프로젝트의 규칙이에요. 대부분은 ESLint가 저장할 때 검사하고(hook), 이 문서는 lint로 잡기 어려운 판단 기준과 예시를 담아요. 괄호 안의 `lint:`는 그 규칙을 검사하는 ESLint 규칙이에요.

## 1. 구조 (Feature-Based + Layered)

```
src/
├─ main.ts, app.module.ts, app.setup.ts   진입점과 전역 설정
├─ modules/{feature}/                     기능 단위. 이름은 명사, kebab-case: user, order-item
│  ├─ index.ts                            public API: 다른 feature가 쓰는 것만 export
│  ├─ {feature}.module.ts
│  ├─ {feature}.controller.ts             HTTP ↔ DTO. 로직 없음
│  ├─ {feature}.service.ts                비즈니스 로직, 트랜잭션
│  ├─ {feature}.repository.ts             DB 접근은 여기서만
│  ├─ {feature}.exception.ts              AppException을 상속한 비즈니스 예외
│  ├─ *.rule.ts                           순수 규칙 함수(판단·계산). Nest·DB·시계 없이 입력만으로 결과
│  ├─ {feature}.constants.ts / .types.ts  상수, 타입
│  ├─ dto/*.dto.ts                        요청·응답 DTO
│  └─ entities/*.entity.ts                TypeORM entity
├─ compositions/{screen}/                 여러 feature를 조합하는 통합 API(13절). controller·service·dto만
├─ common/                                feature를 모르는 공용 코드: exceptions, filters, auth, pagination, options
├─ config/env.ts                          환경 변수(zod 검증)
└─ infra/                                 database(data-source, migrations), health, 외부 API 클라이언트
```

파일은 접미사로 레이어가 정해져요. 목록에 없는 이름은 만들 수 없어요(lint: `boundaries/no-unknown-files`). 필요한 레이어가 더 있으면 프로젝트 `eslint.config.mjs`에서 늘리지 말고 먼저 사용자에게 물어봐요.

### import 규칙 (lint: `boundaries/dependencies`)

| 파일       | 가져올 수 있는 것                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| controller | 같은 feature의 service·dto·exception(`@ApiErrors`용)·constants, common, config                                     |
| service    | 같은 feature의 service·repository·dto·entity·exception·rule·constants, 다른 feature의 `index.ts`, common, config, infra |
| repository | 같은 feature의 entity·constants, common, config, infra                                                             |
| dto        | 같은 feature의 dto·entity·constants, 다른 feature의 `index.ts`, common                                             |
| entity     | 같은 feature의 entity·constants, 다른 feature의 `index.ts`(relation), common                                       |
| module     | 같은 feature의 controller·service·repository·entity·validator·constants, 다른 feature의 `index.ts`                 |
| exception  | 같은 feature의 constants, 다른 feature의 `index.ts`(그 feature 예외를 다시 내보낼 때만), common                    |
| rule       | 같은 feature의 rule·constants·types, common (Nest·TypeORM·CLS·`node:` 모듈은 못 가져와요)                          |
| common     | common, config (feature를 가져오지 않아요)                                                                         |

- 방향은 `controller → service → repository`예요. controller가 repository나 TypeORM을 직접 쓰지 않아요.
- 다른 feature는 **`index.ts`로만** 가져와요: `@/modules/user/index.js`는 되고 `@/modules/user/user.service.js`는 안 돼요. 다른 feature의 repository·테이블에는 직접 가지 않고 그 feature의 service를 써요.
- ESM이라 import에 `.js`를 붙여요: feature 안은 `./user.service.js`, 밖은 `@/modules/user/index.js`.
- 순환 의존이 생기면 `forwardRef`로 가리지 말고 방향을 바꾸거나 공통 부분을 다른 feature로 옮겨요(lint: `no-restricted-imports`).
- Nest 객체(Service, Repository, Controller)는 생성자 주입으로 받아요. `new`로 만들지 않아요(lint: `sonic-be/no-manual-instantiation`).

### rule (순수 규칙 함수)

판단·계산처럼 입력만으로 결과가 정해지는 로직은 `*.rule.ts`에 함수로 둬요(예: `strategy/day-trading.rule.ts`, `fund/allocation.rule.ts`). 같은 feature의 service가 데이터를 모아 rule을 부르고 결과를 저장해요. 백테스트·테스트는 Nest 없이 rule을 바로 불러요.

- 같은 입력이면 같은 결과예요. 지금 시각·난수는 인자로 받아요. `Date.now()`, 인자 없는 `new Date()`, `Math.random()`은 못 써요(lint: `no-restricted-syntax`).
- Nest·TypeORM·CLS·`node:` 모듈을 가져오지 않아요(lint: `no-restricted-imports`). DB·외부 API는 service가 부르고 결과만 넘겨요.
- 예외를 던지지 말고 결과 값(`{ ok: false, reason }` 같은 유니언)으로 돌려줘요. 예외로 바꾸는 일은 service가 해요.

```ts
// fund/allocation.rule.ts
export function allocate(capital: number, ratio: number): number {
  return Math.floor(capital * ratio);
}
```

## 2. API

### URL과 HTTP

- 모든 경로는 `/v1/...`이에요(URI 버저닝, `app.setup.ts`). 호환되지 않게 바꿀 때만 `@Controller({ path, version: '2' })`로 새 버전을 만들어요.
- 경로는 kebab-case 복수 명사예요: `/v1/order-items/:id`. 동사를 넣지 않아요(`/v1/order-items/:id/cancel`처럼 상태 전이가 꼭 필요한 하위 동작만 예외).

| 동작           | 메서드 | 성공 상태                                |
| -------------- | ------ | ---------------------------------------- |
| 목록·단건 조회 | GET    | 200                                      |
| 생성           | POST   | 201 (`@HttpCode(HttpStatus.CREATED)`)    |
| 일부 수정      | PATCH  | 200                                      |
| 삭제           | DELETE | 204 (`@HttpCode(HttpStatus.NO_CONTENT)`) |

상태 코드는 숫자 대신 `HttpStatus.X`를 써요(lint: `@typescript-eslint/no-magic-numbers`).

### DTO와 Swagger

- `@Body()`·`@Query()`로 받는 값은 class-validator가 붙은 `*Dto` 클래스예요(lint: `sonic-be/dto-param-type`). 전역 `ValidationPipe`가 정의하지 않은 필드를 400으로 막아요(`whitelist`, `forbidNonWhitelisted`).
- 핸들러는 반환 타입을 `Promise<XxxResponseDto>`처럼 적어요. Entity를 그대로 돌려주지 않아요(lint: `sonic-be/handler-return-dto`). 변환은 응답 DTO의 `static from(entity)` 하나로 해요.
- 수정 DTO는 `PartialType(CreateXxxDto)`(`@nestjs/swagger`)로 만들어요. 보낸 필드만 검증하고 바꿔요.
- Swagger는 Nest CLI 플러그인이 DTO와 JSDoc 주석으로 만들어요. 필드와 핸들러에 `/** 설명 */`을 달고, controller에 `@ApiTags`를 붙여요. 개발 환경에서 `/docs`로 봐요.
- `openapi.json`은 코드에서 만든 API 문서예요(`npm run openapi`). API를 바꾸면 다시 만들어 커밋해요. CI가 코드와 다르면 실패하고, 이전 버전과 호환되지 않으면(필드 삭제, 타입 변경) 실패해요. 그런 변경이 꼭 필요하면 새 버전(`/v2`)으로 만들어요.

### 응답 형식

- 성공 응답은 감싸지 않고 DTO 그대로예요. 목록만 `{ items, meta: { page, size, total } }`(`PageDto.of`)이에요.
- 목록 API는 `PageQueryDto`(page, size ≤ 100)를 받아요.
- 목록 응답 타입은 feature마다 구체 클래스 `XxxPageDto { items: XxxResponseDto[]; meta: PageMetaDto }`로 적어요(feature 뼈대에 있어요). 제네릭 `PageDto<T>`를 반환 타입으로 쓰면 Swagger가 `items` 타입을 몰라 응답 스키마가 비어요. service는 `PageDto.of(...)`를 그대로 돌려줘도 돼요(모양이 같아요).
- 에러는 전역 필터가 RFC 9457 형식으로 만들어요(`Content-Type: application/problem+json`).

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "...",
  "code": "ORDER_ITEM_NOT_FOUND",
  "instance": "/v1/order-items/9",
  "requestId": "...",
  "errors": [{ "field": "name", "messages": ["..."] }]
}
```

### 에러 응답 문서 (Swagger)

Swagger(`/docs`, `openapi.json`)의 에러 응답은 모두 `ProblemDetailsDto` 스키마와 코드별 예시로 나와요(`common/exceptions/api-errors.ts`).

| 상태  | 붙는 곳                                                                    | 방법                                        |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------- |
| 400   | body·query를 받는 API(`VALIDATION_FAILED`), 숫자 path 파라미터(`HTTP_400`) | 자동                                        |
| 401   | `@Public()`이 아닌 API(`HTTP_401`)                                         | 자동. `@Public()`이면 자물쇠도 빠져요       |
| 403   | `@Roles()`를 붙인 API(`HTTP_403`)                                          | 자동                                        |
| 그 밖 | handler가 받는 비즈니스 예외(`ORDER_ITEM_NOT_FOUND` 등)                    | **`@ApiErrors(예외 클래스, ...)`로 적어요** |

```ts
@ApiErrors(OrderItemNotFoundException, OrderItemForbiddenException)
@Patch(':id')
update(...): Promise<OrderItemResponseDto> {}
```

- service에서 던져 그 API까지 오는 예외는 모두 적어요. Nest Swagger 플러그인은 반환 타입만 보고, service 안의 `throw`는 모르기 때문이에요.
- `@ApiErrors`는 handler마다 한 번만 붙여요(같은 상태 코드의 예외는 한 응답에 예시로 모여요).
- 예외 클래스에는 `static readonly code`·`status`·`example`을 둬요(3절). 없으면 `@ApiErrors`에 넣을 때 컴파일 에러예요.
- 다른 feature의 service가 던지는 예외(예: 댓글 API의 `POST_NOT_FOUND`)는 그 feature `index.ts`에서 내보내고, 이 feature의 `*.exception.ts`에서 다시 내보내 controller가 가져와요: `export { PostNotFoundException } from '@/modules/post/index.js';`

## 3. 예외와 로깅

- 비즈니스 예외는 `AppException(code, status, message)`을 상속해 feature의 `*.exception.ts`에 둬요. `throw new Error`는 쓰지 않아요(lint: `sonic-be/no-generic-error`).
- 예외 클래스에는 Swagger 예시(`@ApiErrors`, 2절)가 읽는 `static` 값을 둬요.

```ts
export class OrderItemNotFoundException extends AppException {
  static readonly code = 'ORDER_ITEM_NOT_FOUND';
  static readonly status = HttpStatus.NOT_FOUND;
  static readonly example = 'order-item 1을(를) 찾을 수 없어요.';

  constructor(id: number) {
    super(
      OrderItemNotFoundException.code,
      OrderItemNotFoundException.status,
      `order-item ${id}을(를) 찾을 수 없어요.`,
    );
  }
}
```

- `NotFoundException` 같은 HTTP 예외는 controller와 common(필터·guard)에서만 써요. service는 HTTP를 몰라요(lint: `no-restricted-imports`).
- 알 수 없는 예외는 필터가 500으로 바꾸고 로그를 남겨요. 운영에서는 내부 메시지를 응답에 넣지 않아요.
- 예외를 잡아서 조용히 넘기지 않아요. 잡았으면 다시 던지거나 다른 예외로 바꿔요.
- 로그는 `new Logger(Xxx.name)`(`@nestjs/common`)으로 남겨요. 출력은 nestjs-pino가 JSON으로 해요. `console`은 쓰지 않아요(lint: `no-console`).
- 비밀번호·토큰·Authorization은 로그에서 가려요(`app.module.ts`의 `redact`). 로그에 요청 본문을 통째로 남기지 않아요.
- 요청마다 ID가 있어요. 받은 `X-Request-Id`를 쓰거나 새로 만들고, 로그·에러 응답(`requestId`)·응답 헤더에 같이 남겨요.

## 4. 데이터베이스 (TypeORM)

- DB 접근은 repository에서만 해요. repository는 `TransactionHost`로 TypeORM `Repository`를 꺼내요. 그래야 `@Transactional()` 안에서 같은 트랜잭션을 써요.

```ts
@Injectable()
export class OrderItemRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}
  private get items(): Repository<OrderItem> {
    return this.txHost.tx.getRepository(OrderItem);
  }
  findPage(skip: number, take: number): Promise<[OrderItem[], number]> {
    return this.items.findAndCount({ order: { id: 'DESC' }, skip, take });
  }
}
```

- 여러 건을 가져올 때는 `take`로 개수를 제한해요. `findBy`·`findAndCountBy`는 쓰지 않아요. QueryBuilder는 `getMany()` 바로 앞 체인에 `.take()`를 넣어요(lint: `sonic-be/require-find-take`).
- SQL에 값을 이어 붙이지 않아요. `where('user.name = :name', { name })`, `query('... $1', [id])`처럼 파라미터로 넘겨요(lint: `sonic-be/no-raw-sql-interpolation`).
- **트랜잭션**: 한 요청에서 두 번 이상 쓰고 함께 성공·실패해야 하면 service 메서드에 `@Transactional()`을 붙여요(lint: `sonic-be/transactional-writes`, warn). 경고가 났는데 트랜잭션이 필요 없으면 이유를 주석으로 남겨요.
- **N+1**: 반복문·`map` 안에서 repository를 부르지 않아요(lint: `no-await-in-loop`, `sonic-be/no-repository-call-in-loop`). `find({ where: { id: In(ids) }, take })` 한 번으로 가져와요. relation은 `relations: { user: true }`나 `leftJoinAndSelect`로 필요한 곳에서만 불러요. `eager`·lazy relation은 쓰지 않아요(lint: `sonic-be/no-eager-lazy-relation`).
- **중복(unique 위반)**: 이메일처럼 겹치면 안 되는 값은 unique 제약으로 막고, 미리 조회하지 않아요(동시에 들어오면 조회로는 못 막아요). repository가 `isUniqueViolation(error)`(`infra/database/unique-violation.ts`)로 잡아 `null`·`false`를 돌려주고, service가 409 예외로 바꿔요. 다른 오류는 다시 던져요.

```ts
async create(fields: Pick<User, 'email' | 'nickname'>): Promise<User | null> {
  try {
    return await this.users.save(this.users.create(fields));
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}
```

- **DB 이름은 snake_case예요.** 테이블은 `@Entity('order_items')`로 직접 적고, 컬럼·FK·조인 테이블 이름은 `SnakeNamingStrategy`(`infra/database/snake-naming.strategy.ts`)가 프로퍼티 이름에서 만들어요(`authorId` → `author_id`, `createdAt` → `created_at`). 코드의 프로퍼티는 camelCase 그대로예요.
  - relation과 FK 컬럼을 함께 둘 때 `@JoinColumn()`에는 `name`을 적지 않아요. strategy가 `author` relation의 FK를 `author_id`로 정해 `authorId` 프로퍼티 컬럼과 합쳐요. `name: 'authorId'`처럼 적으면 컬럼이 따로 하나 더 생겨요.
  - QueryBuilder는 프로퍼티 이름(`post.authorId`)을 쓰고, raw SQL(`query(...)`)만 DB 이름(`author_id`)을 써요.

```ts
@Index()
@Column()
authorId: number;

@ManyToOne(() => User, { nullable: false })
@JoinColumn()
author: User;
```

- **entity**: 비밀번호 같은 컬럼은 `@Column({ select: false })`로 둬요. relation 옵션은 객체 형태로 써요(`relations: { orders: true }`, 문자열 배열은 오타를 못 잡아요).
- **날짜**: 시각 컬럼은 `type: 'timestamptz'`예요(lint: `sonic-be/timestamptz-only`). 날짜만은 `'date'`예요. 서버 시간대는 UTC로 고정되고(`env.TZ`), API는 ISO 8601 문자열로 주고받아요.
- **migration**: 스키마는 migration으로만 바꿔요. `synchronize`는 켜지 않아요(lint: `sonic-be/no-synchronize`).

```bash
npm run migration:generate -- src/infra/database/migrations/add-order-items   # entity를 바꾼 뒤
npm run migration:run
npm run migration:revert
```

migration 이름은 kebab-case로 줘요. 생성된 파일은 고치지 않는 게 원칙이고, 기본 데이터(공통 코드 그룹 등)만 `up`에 `INSERT`로 더해요.
CI는 migration을 모두 적용한 뒤 entity와 차이가 있으면(= migration 누락) 실패해요(`npm run migration:check`).

## 5. 보안

- 환경 변수는 `src/config/env.ts`(zod)에서만 읽어요(lint: `sonic-be/no-direct-env`). 키를 바꾸면 `.env.example`도 바꿔요. 비밀 값은 코드에 쓰지 않아요.
- **모든 API는 기본으로 로그인이 필요해요**(전역 `JwtAuthGuard`). 공개할 API에만 `@Public()`을 붙여요. 권한은 `@Roles('admin')`로 정해요. e2e `auth-guard.e2e-spec.ts`가 `@Public()`이 아닌 모든 라우트를 모아 토큰 없이 401인지 자동으로 확인해요.
- 로그인한 사용자는 handler에서 `@CurrentUser() user: AuthUser`로 받아요(`request.user`를 직접 읽거나 빈 값으로 대신하지 않아요).
- **로그인만으로는 권한이 아니에요.** feature 뼈대는 로그인만 확인해요. 엔드포인트마다 관리자 전용(`@Roles('admin')`)인지, 본인 데이터만인지 정하고, 권한이 없을 때의 403·404를 e2e로 확인해요.
- **남의 데이터: 403인가 404인가**

| 데이터                                    | 남의 것을 조회·수정·삭제하면 | 방법                                                               |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| 비공개(주문, 결제, 내 설정)               | 404                          | repository 조회 조건에 `user.sub`를 넣어 남의 것은 "없음"으로 봐요 |
| 공개(게시글, 댓글처럼 누구나 보는 데이터) | 403                          | 찾은 뒤 작성자를 비교해 `XxxForbiddenException`(403)을 던져요      |

존재를 숨겨야 하면 404, 이미 공개된 데이터라 숨길 게 없으면 403이에요.

- **"내" 데이터 API**: 로그인 사용자 기준 API는 `/v1/users/me`, `/v1/users/me/<복수형>`이에요. 다른 feature의 데이터(내가 쓴 글 등)를 user feature에 두면 순환(`user → post → user`)이 생기므로, 그 feature controller에 두거나 여러 feature를 묶으면 `src/compositions/my-page/`에 둬요(13절).
- **회원가입·로그인**을 만들 때:
  - 비밀번호는 Node 내장 `crypto.argon2`(argon2id, Node 24.7+)로 해시해요. 새 패키지가 필요 없어요. 비교는 `timingSafeEqual`로 해요.
  - 해시 컬럼은 `@Column({ select: false })`이고, 로그인 확인 쿼리에서만 `select: { id: true, passwordHash: true }`로 꺼내요.
  - 없는 이메일도 가짜 해시로 같은 계산을 해서, 응답 시간으로 가입 여부를 알 수 없게 해요. 이메일·비밀번호 중 무엇이 틀렸는지 알려 주지 않아요(같은 401).
  - 로그인은 `POST /v1/auth-tokens`(`@Public()`, 201)로 `{ accessToken, tokenType: 'Bearer', expiresIn }`을 돌려줘요. payload는 `{ sub: 사용자 id, roles }`이고 만료는 `JwtModule` 설정을 따라요. DB 테이블이 없는 feature라 `feature auth-token --no-entity`로 만들어요.
- 응답에는 응답 DTO에 적은 필드만 나가요. entity를 그대로 돌려주지 않아요.
- CORS는 `CORS_ORIGINS`에 적은 곳만 열어요(운영에서 `*` 금지). 요청 수 제한(throttler)과 보안 헤더(helmet)는 전역으로 켜져 있어요.
- 업로드는 `@UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator(...), new FileTypeValidator(...)] }))`로 크기·형식을 검증해요(lint: `sonic-be/uploaded-file-pipe`).

## 6. TypeScript

- `strict`예요. `any`는 쓰지 않아요(lint: `no-explicit-any`, `no-unsafe-*`). 외부 값은 `unknown`으로 받아 zod나 타입 가드로 좁혀요.
- `as`는 쓰지 않아요(`as const`는 괜찮아요, 테스트는 예외). `!`(non-null)도 쓰지 않아요.
- `enum` 대신 `as const`와 유니언 타입이에요(lint: `sonic-be/no-enum`).

```ts
export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];
```

- 이름: 파일·폴더는 kebab-case, 타입·클래스는 PascalCase, boolean은 `is/has/can`으로 시작해요.
- 숫자는 이름 있는 상수로 빼요(lint: `no-magic-numbers`). DTO의 검증 값(`@Max(100)`)과 entity의 컬럼 길이는 예외예요.
- `consistent-type-imports`는 쓰지 않아요. 생성자 주입 타입을 `import type`으로 바꾸면 DI가 깨져요.
- lint를 끄는 주석은 쓰지 않는 게 원칙이에요. 꼭 필요하면 `// eslint-disable-next-line 규칙 -- 이유`처럼 이유를 적어요(lint: `eslint-comments/require-description`).

## 7. 테스트

### 무엇을 테스트하나

| 대상               | 방법                                                                                            | 필수 케이스                                       |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| service            | 단위 테스트(`*.service.spec.ts`), repository·다른 feature service만 `overrideProvider`로 바꿔요 | 정상, 없음(예외), 분기마다                        |
| API                | e2e(`test/{feature}.e2e-spec.ts`), supertest + 실제 Postgres(Testcontainers)                    | 성공 상태·본문, 검증 실패 400, 없음 404, 권한 403 |
| 인증               | `auth-guard.e2e-spec.ts`가 자동으로                                                             | 토큰 없음·잘못된 토큰 401                         |
| 검증기·도메인 규칙 | 단위 테스트                                                                                     | 통과·실패 경계, 장애                              |
| rule               | 단위 테스트(`*.rule.spec.ts`), Nest 모듈 없이 함수를 바로 불러요                                | 경계값, 분기마다                                  |

- `@Transactional()`이 붙은 service의 단위 테스트는 `test/setup/transactional.ts`의 `noOpTransactionalModule`을 imports에 더하고 호출을 `runInCls(moduleRef, () => ...)`로 감싸요. 트랜잭션이 실제로 묶이는지는 e2e에서 확인해요.
- 다른 feature의 service에 기대는 service(예: `CommentService` → `PostService`)는 그 service도 `overrideProvider`로 바꾸고, 이 service가 부르는 메서드만 `vi.fn<PostService['assertExists']>()`로 채워요. 그 service의 실제 동작은 그 feature의 테스트와 e2e가 확인해요.
- 단위 테스트에는 `vitest.config.ts`의 `test.env`(가짜 `DATABASE_URL`·`JWT_SECRET`)가 들어가요. 그래서 `@/config/env.js`를 import하는 service도 테스트할 수 있어요. 새 필수 env 키를 더하면 여기에도 가짜 값을 더해요.
- 버그를 고칠 때는 그 버그를 재현하는 테스트를 먼저 써요.
- 프로젝트 모듈을 `vi.mock`으로 바꾸지 않아요(lint: `sonic-be/no-internal-mock`). 외부 HTTP API는 MSW(`test/setup/msw.ts`의 `server.use`)로 바꿔요.
- e2e는 파일마다 `resetDatabase(app)`로 DB를 비워요. migration이 기본 데이터를 넣는 테이블은 `test/setup/seed-tables.ts`에 적어 남겨요.
- `bearer(app)`는 DB에 없는 사용자(`sub: '1'`)로 토큰만 만들어요. 데이터가 사용자 테이블을 참조하면(작성자 FK 등) 가입 API로 실제 사용자를 만드는 도우미를 `test/setup/`에 두고 써요.

```ts
// test/setup/users.ts
export async function signUp(
  app: INestApplication,
  nickname: string,
): Promise<{ id: number; auth: string }> {
  const response = await request(app.getHttpServer())
    .post('/v1/users')
    .send({
      email: `${nickname}@example.com`,
      password: 'password123',
      nickname,
    })
    .expect(201);
  const { id } = response.body as { id: number };
  return { id, auth: bearer(app, { sub: String(id), roles: ['user'] }) };
}
```

- 테스트 이름은 해요체 문장이에요: `it('이름이 비어 있으면 400과 필드 에러를 돌려줘요')`(lint: `vitest/valid-title`).
- service 커버리지 기준은 80%예요(`npm run test:cov`, `src/modules/**/*.service.ts`). 위임만 하는 compositions service는 e2e로 확인해요.
- e2e는 Docker가 필요해요. `npm run test:e2e`는 빌드한 뒤 migration을 적용하고 돌아요.

## 8. 커밋

Conventional Commits에 설명은 한국어로 써요: `feat(order-item): 목록 조회 API 추가`. 커밋 전에 lint-staged가 바뀐 파일을 format·lint해요.

## 9. 하네스 파일 관리

- `.sonic-harness-be/`는 하네스 원본이 관리해요. 이 프로젝트만의 규칙은 `eslint.config.mjs`나 `AGENTS.md`에 둬요.
- 공통 규칙을 바꿔야 하면 `.sonic-harness-be/` 파일을 고친 뒤 `/sonic-harness-be:contribute`로 원본에 올려요.

## 10. 작업 순서

새 feature를 만들 때:

1. `/sonic-harness-be:feature <이름>`으로 뼈대를 만들어요. DB 테이블이 없는 feature(로그인처럼 다른 feature를 조합)는 `--no-entity`로 controller·service만 만들어요.
2. entity를 정하고 `npm run migration:generate`로 migration을 만들어요(`--no-entity`면 건너뛰어요).
3. 요청·응답 DTO → repository → service(+ 단위 테스트) → controller 순서로 채워요.
4. `app.module.ts`에 모듈을 더하고 e2e를 써요.
5. `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`를 돌리고 결과를 보고해요(AGENTS.md "완료 보고").

## 11. lint 로컬 규칙 목록

| 규칙                                           | 막는 것                                           |
| ---------------------------------------------- | ------------------------------------------------- |
| `no-manual-instantiation`                      | Service·Repository·Controller를 `new`로 만들기    |
| `dto-param-type`                               | `@Body()`·`@Query()`를 DTO가 아닌 타입으로 받기   |
| `handler-return-dto`                           | 핸들러 반환 타입 생략, entity·원시값 반환         |
| `no-generic-error`                             | modules·compositions에서 `throw new Error`        |
| `require-find-take`                            | `take` 없는 목록 조회, `findBy`                   |
| `no-raw-sql-interpolation`                     | SQL 문자열에 값 이어 붙이기                       |
| `no-synchronize`                               | `synchronize: true`                               |
| `no-eager-lazy-relation`                       | eager·lazy relation                               |
| `timestamptz-only`                             | 시간대 없는 시각 컬럼                             |
| `transactional-writes` (warn)                  | `@Transactional()` 없는 여러 번 쓰기              |
| `no-repository-call-in-loop`                   | 반복 콜백 안 repository 호출                      |
| `uploaded-file-pipe`                           | 검증 없는 파일 업로드                             |
| `code-field-explicit`                          | `*Code` 필드의 공통 코드 여부 생략                |
| `validator-no-swallow`                         | 검증기에서 예외를 `false`로 바꾸기                |
| `composition-max-deps` (warn)                  | 통합 API 하나가 feature 6개 이상에 의존           |
| `no-enum`, `no-direct-env`, `no-internal-mock` | enum, `process.env` 직접 읽기, 프로젝트 모듈 mock |

## 12. 공통 코드

`common-codes` feature가 있는 프로젝트(init에서 Y)의 규칙이에요.

### 공통 코드로 둘까, feature로 둘까

| 공통 코드                             | feature(또는 타입)                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 단순 분류·유형: 상품 유형, 지역 구분  | 자기 속성이 있는 데이터: 브랜드(로고, 담당자), 카테고리 트리                                    |
| 관리자가 화면에서 추가·정렬·사용 중지 | 개수가 많거나 검색이 필요한 데이터                                                              |
| 값이 바뀌어도 코드가 바뀌지 않음      | 비즈니스 로직이 값에 따라 달라지는 상태: 주문 상태, 결제 상태 → `as const` 유니언과 도메인 로직 |

여러 feature가 쓴다는 이유만으로 공통 코드로 만들지 않아요. 판단이 애매하면 사용자에게 물어봐요.

### 구조와 관리

- 그룹(`common_code_groups`)과 코드(`common_codes`, 기본 키 `(groupId, code)`)를 나눠요. 그룹 안에서 코드 값은 겹칠 수 없어요(DB가 막아요).
- 코드 값(`code`)과 표시명(`name`)을 나누고, `isActive`·`sortOrder`가 있어요.
- **코드 값은 바꾸지 않고 지우지 않아요.** 관리 API에는 수정(이름·정렬·사용 여부)과 추가만 있어요. 쓰지 않게 된 코드는 `isActive: false`로 꺼요. 그래서 이미 저장된 데이터의 참조가 깨지지 않아요.
- 관리 API는 `@Roles('admin')`이에요.
- **새 그룹**: `common-code-groups.constants.ts`의 `COMMON_CODE_GROUPS`에 더하고, migration으로 `common_code_groups`에 행을 넣어요. 먼저 이 파일에서 같은 그룹이 있는지 찾아요. 그룹 ID는 대문자 스네이크(`PRODUCT_TYPE`)예요.
- 공통 코드는 그룹 단위로 캐시하고, 관리 API로 바꾸면 그 그룹 캐시를 바로 지워요. 메모리 캐시라 인스턴스가 여러 개면 다른 인스턴스는 TTL(60초)이 지나야 바뀌어요. 여러 인스턴스로 운영하면 Redis store로 바꿔요.

### 사용

- 다른 feature는 `CommonCodesService`나 `@IsCommonCode`(`@/modules/common-codes/index.js`)로만 써요. 공통 코드 repository에 직접 가지 않아요.
- 클라이언트는 표시명이 아니라 코드 값을 보내요. 필드 이름은 의미가 드러나게 `productTypeCode`처럼 `*Code`로 끝내요.
- 요청 DTO에서 이름이 `*Code`인 필드는 공통 코드면 `@IsCommonCode(그룹)`, 아니면 `@NotCommonCode()`를 붙여요(lint: `sonic-be/code-field-explicit`). 형식 검증(`@IsString()` 등)은 따로 붙여요.

```ts
export class CreateProductDto {
  @IsString()
  @IsCommonCode('PRODUCT_TYPE')
  productTypeCode: string;

  @IsOptional()
  @IsString()
  @NotCommonCode()
  couponCode?: string;
}
```

- `@IsCommonCode`는 코드가 있는지, 그룹이 맞는지, 활성인지 확인해요. 그룹 이름은 타입이라 오타는 컴파일할 때 잡혀요.
- **수정 정책**: 수정 DTO(`PartialType`)는 보낸 필드만 검증하고, 보내지 않으면 기존 값을 그대로 둬요. 폼 전체를 다시 보내는 클라이언트를 위해 수정 DTO에는 `@IsCommonCode(그룹, { allowInactive: true })`를 쓰고, service에서 **값이 바뀌었으면 활성인지** 다시 확인해요(`commonCodesService.isUsable(group, code)`). 비활성 코드를 새로 고를 수는 없어요.
- DB 장애는 "잘못된 코드"(400)가 아니라 500이에요. 검증기에서 예외를 잡아 `false`로 바꾸지 않아요(lint: `sonic-be/validator-no-swallow`).
- 공통 코드 검증은 존재 여부만 봐요. 주문 상태 전이, 결제 가능 여부 같은 도메인 판단은 DTO 데코레이터가 아니라 service·entity에서 해요.

## 13. 옵션 조회와 통합 API

- 선택 목록은 `OptionDto`(`{ value, label }`)로 통일해요. `value`는 등록·수정 API에 그대로 넘기는 식별값이고, 활성 데이터만 서버가 정한 순서로 줘요.
- 단순 분류는 `GET /v1/common-codes/:groupId/options`, 독립 데이터는 그 feature의 API를 써요. 데이터가 많으면 통합 조회 대신 검색·페이지네이션 API를 만들어요.
- **개별 API가 기본**이에요. 한 화면이 여러 feature의 옵션을 한 번에 받아야 할 때만 `src/compositions/{screen}/`에 통합 API를 만들어요.
- compositions는 조합과 응답 변환만 해요. 다른 feature의 `index.ts`(service)로만 가져오고, repository·entity를 둘 수 없어요(lint: `boundaries`). 비즈니스 로직을 다시 구현하지 않아요.
- composition controller는 다른 feature의 응답 DTO를 `import type`으로만 가져와 반환 타입에 써요(`Promise<PostPageDto>`). 값 import(service 등)는 composition service가 해요.
- 서로 독립인 조회는 `Promise.all`로 병렬로 불러요. 기본 정책은 **하나라도 실패하면 전체 실패**예요. 부분 응답이 필요하면 `Promise.allSettled`를 쓰고 응답 DTO에 섹션마다 `error` 필드를 둬요.
- 통합 API 하나가 feature 6개 이상에 기대면 화면이나 유스케이스 단위로 나눠요(lint: `sonic-be/composition-max-deps`, warn).

## 14. 자동 검사 (CI)

`.github/workflows/ci.yml`이 PR과 main push마다 돌아요. job 이름이 branch protection의 필수 check예요.

| job         | 검사                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint`      | ESLint(경계·이름·TypeScript), typecheck, Prettier, 순환 의존(`npm run lint:cycles`), `.env.example`과 env 스키마 키, controller마다 e2e 파일 |
| `test`      | 단위 테스트와 service 커버리지 80%                                                                                                           |
| `e2e`       | Testcontainers Postgres 위 e2e                                                                                                               |
| `openapi`   | `openapi.json`이 코드와 같은지, Spectral(경로 kebab-case, DELETE 204, POST 201), 이전 버전과 호환(oasdiff)                                   |
| `migration` | migration 누락                                                                                                                               |
| `security`  | 비밀 값 커밋(gitleaks), 운영 의존성 critical 취약점(npm audit), 새 패키지의 이유(PR 본문 "새 의존성")                                        |

- 순환 의존은 컴파일 결과로 봐요. Nest는 생성자 주입 타입도 실행할 때 불러와서, 타입으로만 쓴 import도 순환이에요.
- npm audit은 운영 의존성의 critical만 막아요. high는 Dependabot(`.github/dependabot.yml`) 보안 업데이트로 따라가요.

## FAQ

- **e2e에서 "Could not find a working container runtime strategy"**: Docker 소켓 위치가 기본값이 아니에요. Colima라면 `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`, `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`를 셸 설정에 넣어요.
- **lint를 실행하면 boundaries `mode` deprecated 경고가 나와요**: 하네스가 알고 쓰는 설정이에요. 결과에는 영향이 없어요.
