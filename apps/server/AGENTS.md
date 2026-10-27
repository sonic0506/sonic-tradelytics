# AGENTS.md

이 프로젝트는 sonic-harness-be 규칙을 따라요. 규칙과 예시는 아래 문서에 있어요.

@.sonic-harness-be/harness.md

## 작업 규칙

- 기존 구조와 공통 코드(`src/common`, 다른 feature의 `index.ts`)를 먼저 찾아 재사용해요.
- 요청 범위 밖의 리팩터링은 하지 않아요. 필요해 보이면 끝에 제안만 해요.
- 새 feature는 `/sonic-harness-be:feature <이름>`으로 만들어요.
- 새 API는 DTO(요청·응답), Swagger, 테스트(service 단위 + e2e)를 함께 써요.
- 새 라이브러리는 이유를 말하고 확인을 받은 뒤 설치해요. PR 템플릿의 "새 의존성" 칸에도 적어요.
- 분류·유형 값이 필요하면 공통 코드로 둘지, feature로 둘지 먼저 판단해요(harness.md 12절). 공통 코드 그룹은 `src/modules/common-codes/common-code-groups.constants.ts`에서 먼저 찾아요.
- lint 규칙을 끄는 주석은 쓰지 않아요. 꼭 필요하면 `-- 이유`를 적고 사용자에게 알려요.

## 완료 보고

작업을 마치면 이 순서로 알려요.

1. 바뀐 것: 파일과 동작
2. 검증: 실행한 명령(`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`)과 결과
3. 지키지 못한 규칙이나 확인하지 못한 것, 그 이유

## 이 프로젝트 정보

- 토스증권 오픈API로 국내 주식 단타 봇을 돌리는 1인용 서비스예요. 기획·정책 문서는 저장소 루트 `docs/`에 있어요.
- 진입점은 두 개예요: `engine`(매매 루프·배치, 토스 API 호출과 토큰 발급은 여기만), `api`(화면용 조회·설정·명령). 둘은 PostgreSQL로만 소통해요 (`docs/architecture/adr/0002-split-api-and-engine.md`).
- 토스 API는 클라이언트당 유효 토큰이 1개예요. 다른 곳에서 토큰을 발급하면 engine 토큰이 끊겨요 (`docs/integrations/toss-securities-api.md`).
- 판단 근거를 저장한 뒤에만 주문해요. 근거·주문·체결 기록은 수정·삭제하지 않아요 (`docs/architecture/adr/0003-record-decision-before-order.md`).
- 모노레포(`apps/server`, `apps/web`, npm workspaces)예요. husky·commitlint·CI는 저장소 루트에 있어요.
