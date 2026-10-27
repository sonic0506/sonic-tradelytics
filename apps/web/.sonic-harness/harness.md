# 코딩 하네스 (sonic-harness-fe)

React + TypeScript 프로젝트에 공통으로 쓰는 코딩 규칙이에요. 이 문서만 읽어도 코드를 쓸 수 있게 썼어요.
디자인 규칙(색, 간격, 컴포넌트 선택)은 다루지 않아요. 그건 sonic-ui의 DESIGN.md를 따라요.

**규칙 대부분은 ESLint가 막아요.** 파일을 고치면 hook이 Prettier와 `eslint --fix`를 실행하고,
남은 에러를 돌려줘요. 에러 메시지가 오면 이 문서의 규칙에 맞게 고쳐요. 규칙을 끄는 주석(`eslint-disable`)은 쓰지 않아요.

## 1. 구조 (FSD)

```
src/
├─ app/        전역 설정: providers, router, styles, layouts, config
├─ pages/      라우트 단위 화면 조립       pages/{domain}/
├─ widgets/    여러 도메인을 합친 UI 블록    widgets/{fusion-domain}/
├─ features/   사용자 행위(CUD)            features/{domain}/{feature}/   feature는 동사: create-user, sign-in
├─ entities/   도메인 명사(Read)           entities/{domain}/             domain은 명사: user, order
└─ shared/     도메인을 모르는 공용 자원     shared/{ui,api,lib,hooks,model,assets}/
```

slice 안의 segment는 필요한 것만 만들어요. slice 바로 아래에는 `index.ts`(public API)만 두고, 페이지 컴포넌트를 포함한 나머지는 모두 segment에 둬요(예: `pages/user/ui/user-list-page.tsx`).

| segment | 담는 것                                 | 파일 이름                                       |
| ------- | --------------------------------------- | ----------------------------------------------- |
| `ui`    | React 컴포넌트                          | `user-row.tsx`                                  |
| `model` | DTO, 타입, zod schema                   | `user.dto.ts`, `user.schema.ts`, `user.type.ts` |
| `api`   | 서버 요청 함수                          | `user.api.ts`                                   |
| `hooks` | Query/Mutation 훅, UI와 model을 잇는 훅 | `use-users-query.ts`                            |
| `store` | Zustand store                           | `use-session-store.ts`                          |
| `lib`   | 순수 함수, 포맷터                       | `date-formatters.ts`                            |

### import 규칙 (lint: `boundaries/dependencies`)

- 위 레이어는 **아래 레이어만** 가져와요: `app → pages → widgets → features → entities → shared`.
- 같은 레이어의 다른 slice는 가져오지 않아요. 예: feature → feature, entity → entity는 안 돼요. 둘을 합쳐야 하면 위 레이어(widget, page)에서 조립해요.
- 다른 slice는 **`index.ts`(public API)로만** 가져와요. `@/entities/user`는 되고 `@/entities/user/ui/user-row`는 안 돼요. shared는 segment마다 index가 있어요: `@/shared/api`.
- `index.ts`에는 밖에서 쓰는 것만 export해요.
- slice 안은 상대 경로(`../model/user.dto`), slice 밖은 `@/` 별칭을 써요.
- Next.js(App Router): 라우팅용 `app/`은 **프로젝트 루트**에 두고, route 파일은 `src/pages`를 다시 내보내기만 해요. FSD 레이어는 `src/`에 있어요. 루트에 빈 `pages/` 폴더(`.gitkeep`)를 두면 Next가 `src/pages`를 Pages Router로 읽지 않아요. 대신 `next-env.d.ts`에 Pages Router 호환 타입이 들어가 `usePathname`·`useSearchParams`·`useParams`가 `null`을 돌려줄 수 있어요. `usePathname() ?? ''`처럼 좁혀 써요.

```tsx
// app/users/page.tsx (Next 루트)
export { UserListPage as default } from '@/pages/user';
```

## 2. 데이터 흐름

```
shared/api (http 클라이언트)
  → entities/{d}/api           조회: *.queries.ts의 queryOptions 팩토리
  → entities/{d}/hooks         useSuspenseQuery(xxxQueries.list(...))
  → features/{d}/{f}/api + hooks  생성·수정·삭제: useMutation
  → entities/*/ui              props로만 데이터를 받음 (api, hooks, store import 금지)
  → widgets / pages            훅을 불러 데이터를 내려 주고 Suspense·ErrorBoundary 배치
```

- `fetch`는 `api/` segment에서만 써요. axios는 쓰지 않아요(lint).
- OpenAPI 스펙이 있으면 `npx openapi-typescript <스펙> -o src/shared/api/schema.d.ts`로 타입을 만들고, DTO는 거기서 꺼내 써요. 손으로 다시 쓰지 않아요.
- 쿼리는 entity의 **`api/<도메인>.queries.ts`**에 `queryOptions` 팩토리로 모아요. 키와 queryFn이 한곳에 있어서 조회·prefetch·invalidate가 같은 것을 써요. 자세한 기준은 아래 "QueryKey"를 봐요.

### QueryKey

| 기준   | 규칙                                                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 위치   | `entities/<도메인>/api/<도메인>.queries.ts`의 `<도메인>Queries` 객체 하나. slice `index.ts`로 export해요                                                                         |
| 모양   | `[도메인, 범위, 파라미터 객체]`. 예: `['user']`, `['user', 'list', { page, q }]`, `['user', 'detail', id]`. 도메인 이름은 entities slice 이름과 같아요                           |
| 만들기 | `all: () => ['user'] as const`, 나머지는 `queryOptions({ queryKey: [...xxxQueries.all(), 범위, 파라미터], queryFn })`                                                            |
| 쓰기   | 조회 `useSuspenseQuery(userQueries.list(params))`, 변경 뒤 `invalidateQueries({ queryKey: userQueries.all() })`(도메인 전체) 또는 `userQueries.list(params).queryKey`(특정 목록) |
| 금지   | 훅·queryClient 메서드에 `queryKey: ['...']`를 직접 쓰기(lint: `@tanstack/query/prefer-query-options`), 다른 도메인 키를 직접 만들기                                              |

- mock은 MSW예요. handler는 해당 slice의 `api/*.mock.ts`에 만들고 그 slice `index.ts`로 export해요(`userHandlers`). 모으는 곳은 **`app/mocks/handlers.ts`** 하나예요(shared는 entities를 몰라서 shared에서 모으지 않아요).
  - 테스트: `vitest.setup.ts`가 `shared/testing`의 `server`에 이 handler를 등록해요. 테스트에서는 `server.use(...)`로 빈 목록·에러만 덮어써요. 테스트마다 `setupServer`를 새로 만들지 않아요.
  - 개발 화면(Vite): `src/main.tsx`에서 dev일 때만 `@/app/mocks/browser`의 `worker.start()` 뒤에 렌더해요. `public/mockServiceWorker.js`는 `npx msw init public --save`로 만들어요(init이 해요).
  - 개발 화면(Next): 템플릿이 이미 연결해 뒀어요. 서버 prefetch는 루트 `instrumentation.ts` → `app/mocks/server.ts`, 브라우저는 `app/providers/mock-starter.tsx`(`next/dynamic` + `ssr: false`)가 받아요. `.env.development.local`에 `NEXT_PUBLIC_API_MOCKING=true`를 두면 켜져요. `msw/browser`를 다른 곳에서 직접 import하지 않아요(서버 번들에서 풀리지 않아 빌드가 깨져요).

```ts
// shared/api/http.ts
export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) throw new HttpError(response.status, path);
  return (await response.json()) as T;
}

// entities/user/api/user.api.ts
export const getUsers = (params: GetUsersParams) => http<UserDto[]>(`/users?page=${params.page}`);

// entities/user/api/user.queries.ts
export const userQueries = {
  all: () => ['user'] as const,
  list: (params: GetUsersParams) =>
    queryOptions({ queryKey: [...userQueries.all(), 'list', params], queryFn: () => getUsers(params) }),
};

// entities/user/hooks/use-users-query.ts
export function useUsersQuery(params: GetUsersParams) {
  return useSuspenseQuery(userQueries.list(params));
}

// features/user/create-user/hooks/use-create-user-mutation.ts
export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userQueries.all() }),
  });
}

// entities/user/ui/user-row.tsx — props만 받아요
export function UserRow({ user, onSelect }: UserRowProps) { … }
```

## 3. 로딩과 에러 (Suspense + ErrorBoundary)

- 조회는 `useSuspenseQuery`만 써요. `useQuery`는 lint가 막아요. 그래서 컴포넌트 안에 `isLoading`/`isError` 분기가 없어요.
- 로딩은 `<Suspense fallback>`, 에러는 `react-error-boundary`의 `<ErrorBoundary>`가 맡아요. 둘 다 **데이터를 쓰는 블록 바로 바깥**(보통 page가 widget을 감쌀 때)에 둬요. 페이지 전체를 하나로 감싸지 않아요.
- 다시 시도는 `QueryErrorResetBoundary`의 `reset`과 ErrorBoundary의 `resetErrorBoundary`를 함께 불러요.
- 빈 목록(데이터 0건)은 에러가 아니에요. 데이터를 받은 컴포넌트가 직접 빈 상태를 그려요.
- mutation 결과(성공·실패)는 Toast로 알려요. mutation 에러는 ErrorBoundary로 보내지 않아요.
- `app/providers`에 앱 전체 ErrorBoundary 하나를 두어 렌더 예외를 받아요.

```tsx
// pages/user/ui/user-list-page.tsx
export function UserListPage() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <ListError onRetry={resetErrorBoundary} />
          )}
        >
          <Suspense fallback={<UserListSkeleton />}>
            <UserListSection />
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

## 4. 상태 관리

위에서부터 차례로 보고, 처음 맞는 곳에 둬요.

| 상태                                              | 둘 곳                                                                    | 강제                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 서버 데이터                                       | TanStack Query(`*.queries.ts`). 다른 곳에 복사하지 않아요                | lint                                                                     |
| URL로 표현할 수 있는 것(필터, 페이지, 검색어, 탭) | **nuqs**. 페이지 slice의 `model/use-*-search-params.ts` 훅               | lint: `nuqs`는 `model/`에서만, `useSearchParams` 직접 사용 금지          |
| 한 컴포넌트 안                                    | `useState`. 값이 여러 개로 함께 바뀌면 `useReducer`                      | —                                                                        |
| 묶인 컴포넌트(compound) 내부 공유                 | **Context**. 예: 모달의 `Root`·`Trigger`·`Content`가 열림 상태를 나눌 때 | lint: `createContext`는 `ui/`에서만, `index.ts`로 `*Context` export 금지 |
| 여러 화면이 함께 쓰는 클라이언트 상태             | **Zustand**. 로그인 정보, UI 환경설정(테마, 보기 방식)만                 | lint: `zustand`는 `store/`에서만, selector 없는 `useXxxStore()` 금지     |

### URL 상태 (nuqs)

```ts
// pages/user/model/use-user-list-search-params.ts
export function useUserListSearchParams() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    q: parseAsString.withDefault(''),
  });
}
// pages/user/ui/user-list-page.tsx
const [{ page, q }, setSearchParams] = useUserListSearchParams();
```

- adapter는 `app/providers/url-state-adapter.tsx`가 프레임워크에 맞게 넣어요(Vite `nuqs/adapters/react`, Next `nuqs/adapters/next/app`). React Router를 붙이면 `nuqs/adapters/react-router/v7`로 바꿔요.
- 테스트는 `renderWithQuery(ui, { searchParams: '?page=2' })`로 시작 값을 줘요.

### Context

- 묶여서 함께 동작하는 컴포넌트 **내부 전달용으로만** 써요. 화면 사이 공유, 앱 전역 값, 서버 데이터에는 쓰지 않아요.
- 파일은 그 컴포넌트 옆(`ui/<컴포넌트>/<컴포넌트>.context.tsx`)에 두고, slice 밖으로는 컴포넌트만 내보내요.
- `null` 기본값 + 꺼내 쓰는 훅(`useXxx()`)에서 Provider 밖이면 에러를 던져요.

```tsx
// entities/user/ui/user-dialog/user-dialog.context.tsx
export const UserDialogContext = createContext<UserDialogState | null>(null);
export function useUserDialog() {
  const state = useContext(UserDialogContext);
  if (!state) throw new Error('UserDialog 안에서만 써요.');
  return state;
}
```

### Zustand

- `zustand`는 `store/` segment에서만 import해요. 위치는 `entities/<도메인>/store/use-<도메인>-store.ts`예요.
- 지금 있는 store: 로그인 정보(`entities/session`). **새 store는 먼저 사용자에게 물어봐요.**
- 서버에서 받은 목록이나 상세는 넣지 않아요. Query 캐시가 그 역할이에요.
- 컴포넌트에서는 selector로 필요한 값만 꺼내요: `useSessionStore((s) => s.session)`. `useSessionStore()`는 lint가 막아요.
- `persist`(새로고침 뒤 유지)는 UI 환경설정에만 써요. **토큰·개인정보는 저장하지 않아요**(로그인은 httpOnly 쿠키 + 앱 시작 때 세션 조회).
- Next(서버 렌더링)에서 `persist`는 `skipHydration: true`로 두고 마운트 뒤 `persist.rehydrate()`를 불러요(서버와 첫 화면이 달라 hydration 에러가 나요). 테마처럼 첫 그리기 전에 값이 필요하면 `<head>`의 작은 init script로 먼저 적용하고 `<html suppressHydrationWarning>`을 둬요.

## 5. 이름 규칙

| 대상                       | 규칙                                                                                 | 예                                                          | lint   |
| -------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------ |
| 폴더, 파일                 | kebab-case                                                                           | `user-profile-card.tsx`, `use-users-query.ts`               | ✓      |
| 폴더 수                    | 복수형 (`hooks`, `assets`). FSD segment(`ui`, `api`, `model`, `lib`, `store`)는 예외 |                                                             |        |
| 컴포넌트, 타입, 인터페이스 | PascalCase                                                                           | `UserProfileCard`, `UserDto`                                | ✓ 타입 |
| 훅                         | `use` + PascalCase                                                                   | `useUsersQuery`, `useCreateUserMutation`                    |        |
| 변수, 함수                 | camelCase                                                                            | `userName`, `getUser`                                       | ✓      |
| 상수                       | UPPER_SNAKE_CASE                                                                     | `MAX_RETRY_COUNT`                                           |        |
| boolean                    | `is`·`has`·`can`                                                                     | `isLoading`, `hasError`, `canSubmit`                        | ✓      |
| 이벤트 핸들러              | `handle` + 대상 + 동작                                                               | `handleInputChange`                                         |        |
| 콜백 prop                  | `on` + 동작                                                                          | `onSelect`                                                  |        |
| 요청 타입                  | GET 목록 `Get+복수`, 단건 `Get+단수+By조건`, `Create`/`Update`/`Delete`+단수         | `GetUsersParams`, `GetUserById`, `CreateUser`               |        |
| 에셋                       | 파일 kebab-case, export는 PascalCase                                                 | `export { default as UserAvatar } from './user-avatar.svg'` |        |

- `data`, `temp`, `info`처럼 뜻 없는 이름은 쓰지 않아요. 같은 뜻은 같은 낱말로 써요(`user`와 `member` 섞어 쓰지 않기).
- 하위 컴포넌트는 이름 있는 export로만 내보내요(`CardHeader`). `default export`는 Next route 파일에서만 써요.

## 6. TypeScript

- `.sonic-harness/tsconfig.strict.json`을 extends해요: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
- 타입만 가져올 때는 `import type`을 써요.

| 규칙           | 기준                                                                                                                                                                                                                | lint                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `any`          | 쓰지 않아요. 라이브러리가 `any`를 돌려줘도 그대로 퍼뜨리지 않고 타입을 붙여요                                                                                                                                       | `no-explicit-any`, `no-unsafe-*` |
| `unknown`      | 외부 값을 받는 **경계에서만**: `api/`(응답), `model/*.schema.ts`(zod 파서), `lib/`의 파서, `catch (error)`, `shared/config`. 받은 즉시 zod나 타입 가드로 좁혀서 넘겨요                                              | `sonic/unknown-at-boundary`      |
| `as`           | 쓰지 않아요(`as const`는 괜찮아요). 응답 타입을 붙이는 경계(`api/`, `lib/`, `shared/`, 테스트)만 허용하고, 객체 리터럴 `{…} as T`는 어디서도 안 돼요. 대신 타입 주석(`const user: User = …`)이나 `satisfies`를 써요 | `consistent-type-assertions`     |
| deprecated API | 쓰지 않아요. 라이브러리가 `@deprecated`로 표시한 함수는 안내된 대체 API를 써요(예: `prefetchQuery` → `query(...).catch(noop)`, `isServer` → `environmentManager.isServer()`)                                        | `no-deprecated`                  |
| `!` (non-null) | 쓰지 않아요. `if (!x) return`, `??`, `?.`로 처리해요                                                                                                                                                                | `no-non-null-assertion`          |
| `enum`         | 쓰지 않아요. `const ROLE = { admin: 'admin' } as const` + `type Role = (typeof ROLE)[keyof typeof ROLE]`                                                                                                            | `sonic/no-enum`                  |
| `switch`       | 유니언을 다루면 모든 경우를 써요. 값이 늘면 lint가 알려 줘요                                                                                                                                                        | `switch-exhaustiveness-check`    |
| import 순서    | 부수 효과 import(`import './x.css'`) → 외부 패키지 → `@/` → 상대 경로. 직접 맞추지 않고 `eslint --fix`(hook·lint-staged)가 맞춰요                                                                                   | `simple-import-sort`             |

### 환경 변수

- `process.env`, `import.meta.env`는 `src/shared/config/env.ts`에서만 읽어요. 다른 곳은 `import { env } from '@/shared/config'`를 써요(`sonic/no-direct-env`).
- 새 값은 env.ts의 zod 스키마에 넣어요. 없거나 형식이 틀리면 앱이 시작할 때 바로 실패해요.
- 브라우저에 보이는 값만 env.ts에 둬요(Vite `VITE_*`, Next `NEXT_PUBLIC_*`). Next는 `process.env.NEXT_PUBLIC_X`를 글자 그대로 써야 번들에 들어가서 하나씩 적어요.
- 비밀 값(API 키, DB 주소)은 Next에서만 `src/shared/server/env.server.ts`에 두고 맨 위에 `import 'server-only'`를 넣어요. Vite에는 비밀 값을 두지 않아요(모두 브라우저에 보여요).
- 실제 값은 `.env.local`(커밋하지 않음)에, 이름과 예시는 `.env.example`에 둬요.

## 7. 테스트

사용자 행동을 기준으로 테스트해요. 적은 테스트로 실제 동작을 지키는 게 목표예요. coverage 수치는 정하지 않고, 대신 아래 **필수 케이스**를 지켜요.

### 무엇을 테스트하나

| 대상                             | 방식                                                                   | 필수 케이스                                                                           |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 데이터 화면(page·widget)         | 통합: `renderWithQuery` + MSW                                          | 정상, 빈 목록, 서버 에러. URL 상태가 있으면 시작 값(`searchParams`)으로 불러오는 경우 |
| 사용자 동작(feature UI)          | 통합                                                                   | 성공(결과가 화면에 반영), 실패(실패 문구). 폼이면 검증 실패                           |
| 묶인 컴포넌트(Context)           | 통합                                                                   | 부품끼리의 동작(열기 → 확인 / 취소)                                                   |
| `lib` 순수 함수                  | 단위                                                                   | 경계값                                                                                |
| entities ui·hooks 단독           | 분기나 계산이 있을 때만                                                | —                                                                                     |
| E2E(Playwright, `e2e/*.spec.ts`) | 로그인·결제처럼 막히면 서비스가 멈추는, 여러 화면을 건너는 핵심 흐름만 | 로컬에서 실행. CI는 첫 E2E가 생길 때 추가                                             |

로딩 상태는 fallback이 보이는지만 확인해요. 구현 세부(state 값, className, 훅 호출 횟수)는 확인하지 않아요.

### 어떻게 쓰나

- 위치는 소스 옆 `*.test.ts(x)`예요. `describe('컴포넌트·함수 이름')`로 묶어요.
- 이름은 **해요체 문장**이에요: `it('검색어가 있으면 그 결과만 보여 줘요')`. 테스트 하나는 동작 하나만 확인하고, 준비 → 행동 → 확인 순서로 써요.
- 요소는 `screen.getByRole` → `getByLabelText` → `getByText` 순서로 찾아요. `getByTestId`, `container.querySelector`는 쓰지 않아요. 비동기는 `findBy…`로 기다려요.
- 입력은 `userEvent.setup()`으로 해요. `fireEvent`는 쓰지 않아요.
- **네트워크는 MSW로만** 바꿔요. 기본 응답은 `app/mocks/handlers.ts`, 경우별 응답은 테스트 안 `server.use(...)`예요. 프로젝트 모듈을 `vi.mock('@/…')`이나 `vi.mock('./…')`으로 바꾸지 않아요. 시간·브라우저 API 같은 외부만 `vi.useFakeTimers`, `vi.spyOn`을 써요.
- 렌더는 `@/shared/testing`의 `renderWithQuery(ui, { searchParams })`를 써요(테스트마다 새 `QueryClient`, `retry: false`, URL 시작 값).
- jest-dom 타입은 `shared/testing/jest-dom.d.ts`가 넣어요. tsconfig `types`를 고치지 않아요.

```tsx
describe('UserListPage', () => {
  it('사용자가 없으면 빈 상태를 보여 줘요', async () => {
    server.use(http.get('/api/users', () => HttpResponse.json([])));
    renderWithQuery(<UserListPage />);
    expect(await screen.findByText('사용자가 없어요.')).toBeInTheDocument();
  });

  it('검색어를 입력하면 그 결과만 보여 줘요', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserListPage />, { searchParams: '?page=1' });
    await user.type(
      screen.getByRole('searchbox', { name: '사용자 검색' }),
      'kim',
    );
    expect(await screen.findByText('김소닉')).toBeInTheDocument();
  });
});
```

### lint가 막는 것 (`*.test.ts(x)`)

| 규칙                                                                | 막는 것                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `vitest/valid-title`                                                | 해요체 문장이 아닌 테스트 이름                                           |
| `vitest/no-focused-tests`, `expect-expect`, `no-identical-title` 등 | `.only`, 확인 없는 테스트, 같은 이름                                     |
| `testing-library/*` (react 권장)                                    | `container`·DOM 직접 접근, `screen` 없이 찾기, 기다리지 않는 비동기 쿼리 |
| `testing-library/prefer-user-event`                                 | `fireEvent`                                                              |
| `sonic/no-test-id`                                                  | `*ByTestId`                                                              |
| `sonic/no-internal-mock`                                            | 프로젝트 모듈 `vi.mock`                                                  |

## 8. 커밋

Conventional Commits, 설명은 한국어예요. commitlint가 `commit-msg`에서 막아요.

커밋 전(`pre-commit`)에는 lint-staged가 staged 파일에 Prettier와 `eslint --fix`를 실행해요. 고칠 수 있는 건 고쳐서 커밋하고, 남은 lint 에러가 있으면 커밋이 막혀요. PR과 main push마다 CI(`.github/workflows/ci.yml`)가 lint·typecheck·test·build를 실행해요. 검사를 건너뛰는 `--no-verify`는 쓰지 않아요.

```
feat(user): 사용자 목록 화면 추가
fix(session): 로그아웃 뒤 이전 이름이 남는 문제 수정
```

type: `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `style` · `perf` · `build` · `ci`. scope는 slice 이름이에요.

## 9. 하네스 파일 관리

이 프로젝트는 `sonic-harness` Claude Code 플러그인으로 하네스를 받아요.

| 위치                                                                                                                            | 주인        | 고치는 법                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `.sonic-harness/` (이 문서, `eslint.base.mjs`, `prettier.base.mjs`, `commitlint.base.mjs`, `tsconfig.strict.json`, `lock.json`) | 하네스 원본 | 공통 규칙을 바꿀 때만 고쳐요. 고친 뒤 `/sonic-harness:contribute`로 원본에 PR을 올려요 |
| `eslint.config.mjs`, `tsconfig.json`, `CLAUDE.md`, `src/`                                                                       | 이 프로젝트 | 이 프로젝트만의 규칙과 설정은 여기에 둬요                                              |

- `lock.json`은 손으로 고치지 않아요. 플러그인 명령이 관리해요.
- 명령어: `/sonic-harness:status`(상태), `/sonic-harness:update`(최신 규칙 받기), `/sonic-harness:check`(바뀐 규칙으로 코드 점검), `/sonic-harness:contribute`(원본에 PR).

## 10. 작업 순서

1. 어느 레이어와 slice에 둘지 먼저 정해요. Read는 entities, 행위는 features, 조합은 widgets예요.
2. model → api → hooks → ui → (widget) → page 순서로 만들어요.
3. 각 slice의 `index.ts`에 밖에서 쓸 것만 export해요.
4. MSW handler와 테스트를 함께 써요.
5. `npm run lint`, `npm run typecheck`, `npm test`가 통과해야 끝이에요.

## 11. Next.js (App Router)

Vite와 같은 FSD·데이터 규칙을 쓰고, 아래만 더해요. 라우팅 `app/`은 루트에 두고, route 파일은 `src/pages`를 다시 내보내기만 해요(1절).

### 렌더링 결정표

Next 16의 Cache Components 기준이에요. 기본은 요청마다 그리고, 캐시는 `'use cache'`로 직접 켜요.

| 데이터 성격                          | 방식                             | 코드                                                            |
| ------------------------------------ | -------------------------------- | --------------------------------------------------------------- |
| 공개, 거의 안 바뀜(소개, 문서, 공지) | 정적                             | 데이터 함수에 `'use cache'` + `cacheLife('days')`               |
| 공개, 자주 바뀜(공개 목록)           | ISR처럼                          | `'use cache'` + `cacheLife('minutes')` + `cacheTag('<도메인>')` |
| 요청마다 다름(쿠키, 검색어, 개인화)  | 동적 + 스트리밍                  | 캐시 없이, 요청 값을 읽는 부분만 `<Suspense>`로 감싸요          |
| 로그인 뒤 상호작용이 많은 화면       | 서버 prefetch + 클라이언트 Query | 아래 예시                                                       |

```tsx
// src/pages/user/ui/user-list-page.tsx (서버 컴포넌트)
export async function UserListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Number((await searchParams).page ?? 1);
  const queryClient = getQueryClient();
  // 실패해도 화면은 그려요. 에러는 클라이언트 쪽 ErrorBoundary가 받아요(prefetchQuery는 deprecated)
  await queryClient.query(userQueries.list({ page })).catch(noop);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<UserListSkeleton />}>
        <UserListSection />{' '}
        {/* 'use client' ui: useSuspenseQuery(userQueries.list(...)) */}
      </Suspense>
    </HydrationBoundary>
  );
}
```

- 서버와 클라이언트가 같은 `xxxQueries` 팩토리를 써요. QueryClient는 `@/shared/api`의 `getQueryClient()`예요(서버는 요청마다 새것, 브라우저는 하나).
- 생성·수정·삭제는 Vite와 같이 `useMutation` + `http()` + invalidate예요. Server Action은 JS 없이도 동작해야 하는 폼(로그인 등)과 서버 캐시 무효화(`revalidateTag`)에만 써요.
- 서버에서 `http()`는 `API_ORIGIN` 환경 변수로 절대 주소를 만들어요.
- 정적 페이지는 빌드 때 그려져요. 그때 부를 API가 없으면 빌드가 실패하니, 빌드 때 필요한 데이터는 파일이나 빌드 환경에서 닿는 주소로 받아요.

### 라우트 파일

- 동적 라우트(`[slug]`)는 `generateStaticParams`도 slice에서 다시 내보내요: `export { DetailPage as default, generateStaticParams } from '@/pages/detail';`. Cache Components에서는 `dynamicParams`를 쓸 수 없어서, 알려진 param을 **모두** 돌려줘야 없는 주소의 `notFound()`가 정적 404가 돼요(빠지면 200 + noindex로 응답해요).
- `app/not-found.tsx`는 꼭 만들어요. Next 기본 404 화면의 전역 `<style>`(`body` 배경)이 Cache Components의 Activity로 숨겨진 채 DOM에 남아, 다른 페이지로 이동한 뒤에도 배경을 바꿔요.
- `app/error.tsx`·`app/global-error.tsx`는 Next가 파일 자체에 `'use client'`를 요구해서, "route 파일은 다시 내보내기만"과 "`'use client'`는 `ui/`·`app/providers`에만"의 예외예요. 첫 줄 `'use client';` 다음에 `src/pages`를 다시 내보내요.
- 이미지 import 타입(`*.png`)은 `next-env.d.ts`(`.gitignore`)에 있어요. CI는 build 전에 lint·typecheck를 돌려서 이 파일이 없으면 실패해요. `package.json`의 `prepare`에 `next typegen`을 넣어 `npm ci` 때 만들어요(`"prepare": "husky && next typegen"`).

### 서버/클라이언트 경계

| 규칙                                                                                                                                    | lint                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/pages`·`widgets`의 화면 파일은 서버 컴포넌트예요. `'use client'`는 상호작용이 있는 `ui/` 컴포넌트(leaf)와 `app/providers`에만 둬요 | `sonic/use-client-location`                                      |
| 비밀 키·서버 전용 코드는 `*.server.ts`에 두고 맨 위에 `import 'server-only'`                                                            | `sonic/server-only-guard`                                        |
| `ui/` 컴포넌트는 `*.server` 모듈을 가져오지 않아요. 서버 값은 props나 Query hydration으로 받아요                                        | `no-restricted-imports`                                          |
| `next/image`, `next/link`, Core Web Vitals                                                                                              | `@next/eslint-plugin-next` (Next 프로젝트의 `eslint.config.mjs`) |
