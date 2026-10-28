# API 명세

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-28
> 관련: [데이터 모델](./data-model.md) · [엔진 설계](./engine.md) · [기능 명세 F1~F4](../product/features/) · [ADR-0002](./adr/0002-split-api-and-engine.md) · [ADR-0006](./adr/0006-network-level-access-control.md)

web(Next.js)이 부르는 api 프로세스의 엔드포인트 목록이에요. **화면과 엔드포인트의 대응, 정책을 어디서 검사하는지, 엔진에 무엇을 넘기는지**를 정해요. 필드 하나하나는 코드의 DTO와 Swagger가 출처예요. 코드에서 만든 `apps/server/openapi.json`이 최종 명세이고, 이 문서와 다르면 이 문서를 고쳐요.

## 원칙

1. **api는 토스를 부르지 않아요**: 계좌·시세처럼 토스에서 오는 값은 engine이 DB에 쓴 값을 읽어요. 그래서 몇 초 늦을 수 있고, 화면에 기준 시각을 같이 보여줘요 ([ADR-0002](./adr/0002-split-api-and-engine.md))
2. **매매에 영향을 주는 동작은 명령으로 보내요**: 정지·청산·킬 스위치·투자금 확대는 api가 직접 처리하지 않고 `command` 행을 넣어요. 실행과 결과는 engine이 정해요 ([ADR-0004](./adr/0004-postgres-notify-for-commands.md))
3. **검사는 두 번 해요**: api는 저장할 때 입력과 정책을 검사하고, engine은 실행 직전에 다시 검사해요. 사이에 상태가 바뀔 수 있어서예요. 예) 투자금 확대는 api가 보유 종목이 없음을 확인하고, engine이 처리할 때 한 번 더 확인해요
4. **기록은 화면에서도 고칠 수 없어요**: 판단·주문·체결·리스크 이벤트는 조회 API만 있어요 (NFR-04)
5. **실시간은 폴링으로 해요**: 웹소켓·SSE를 두지 않아요. 1인용이고 화면 갱신은 몇 초면 충분해요

## 공통 규칙

[서버 하네스 2절](../../apps/server/.sonic-harness-be/harness.md)을 따라요. 요약하면 아래와 같아요.

| 항목 | 규칙 |
| --- | --- |
| 경로 | `/v1/` + kebab-case 복수 명사. 상태 전이만 하위 동작 허용 (`/v1/bots/:id/release`) |
| 성공 | 조회 200, 생성 201, 수정 200, 삭제 204. 성공 응답은 감싸지 않아요 |
| 목록 | `?page&size`(size ≤ 100), 응답 `{ items, meta: { page, size, total } }` |
| 에러 | RFC 9457 `application/problem+json`, `code`는 아래 [에러 코드](#에러-코드) |
| 금액 | 원 단위 정수(number). 비율은 0~1, 손익률·손실 한도는 % 값 ([데이터 모델 공통 규칙](./data-model.md#공통-규칙)) |
| 시각 | ISO 8601 (`+09:00`). 날짜 필터는 `from`, `to` (거래일, `YYYY-MM-DD`, 둘 다 포함) |
| 인증 | 모든 경로에 `Authorization: Bearer <web 토큰>`이 필요해요. 아래 [인증](#인증) |

## 인증

[ADR-0006](./adr/0006-network-level-access-control.md)대로 앱 로그인은 없어요. 대신 하네스의 전역 `JwtAuthGuard`는 그대로 켜 두고, 토큰 하나만 써요 ([Q-021](../project/open-questions.md#q-021)).

| 항목 | 정한 것 |
| --- | --- |
| 토큰 | 서버 비밀 키(`JWT_SECRET`)로 서명한 JWT 하나. payload `{ sub: 'web', roles: ['admin'] }`, 만료 1년 |
| 발급 | 로그인 API 없음. 서버 저장소의 스크립트로 한 번 만들어요(M1). 만든 값은 출력만 하고 파일에 남기지 않아요 |
| 보관 | web 서버 쪽 환경 변수(예: `API_TOKEN`)에만 둬요. `NEXT_PUBLIC_` 접두사를 붙이지 않아서 브라우저 번들에 들어가지 않아요 |
| 호출 경로 | 브라우저 → web 서버(Next.js 서버 쪽 코드) → api. web 서버가 토큰을 붙여요. 브라우저가 api를 직접 부르지 않아요 |
| 교체 | 새 토큰을 만들어 web 환경 변수를 바꾸고 재배포해요. 토큰이 새었으면 `JWT_SECRET`을 바꿔 기존 토큰을 모두 무효로 만들어요 |
| 공개 경로 | `GET /health`만 `@Public()`이에요 (Docker 헬스체크) |

- 네트워크(Tailscale)가 첫 번째 벽이고, 이 토큰이 두 번째 벽이에요. 토큰이 없으면 Tailscale 안에서도 api를 부를 수 없어요
- 사용자가 한 명이라 권한 구분은 없어요. 모든 경로는 `admin` 토큰 하나로 불러요

## 엔드포인트 한눈에

| 화면 | 메서드·경로 | 요구사항 | 우선 |
| --- | --- | --- | --- |
| 공통 | `GET /v1/engine-status` | NFR-01, 07 | Must |
| 공통 | `POST /v1/commands`, `GET /v1/commands/:id` | FR-BOT-04, 09, POL-RISK-10 | Must |
| 홈 | `GET /v1/home` | FR-PERF-01 | Must |
| 봇 만들기 | `GET /v1/bot-defaults` | FR-BOT-01, 07 | Must |
| 봇 만들기 | `POST /v1/allocation-previews` | FR-BOT-05 | Must |
| 봇 만들기 | `POST /v1/bots` | FR-BOT-01, 02 | Must |
| 봇 목록·상세 | `GET /v1/bots`, `GET /v1/bots/:id` | FR-BOT-06, 10 | Must |
| 봇 설정 | `PATCH /v1/bots/:id` | FR-BOT-10 | Must |
| 규칙 값 | `GET /v1/bots/:id/versions`, `POST /v1/bots/:id/version-previews`, `POST /v1/bots/:id/versions` | FR-BOT-03, 11 | Must |
| 상한 해제 | `POST /v1/bots/:id/release` | FR-BOT-06 | Must |
| 봇 비교 | `GET /v1/bot-stats` | FR-PERF-02, FR-MAN-05 | Must |
| 봇 상세 | `GET /v1/bots/:id/daily-results` | FR-PERF-03, 10 | Must |
| 투자 내역 | `GET /v1/positions`, `GET /v1/position-summaries` | FR-PERF-04~07 | Must |
| 투자 내역 | `GET /v1/positions/:id` | FR-PERF-04, F3 근거 카드 | Must |
| 근거 | `GET /v1/decisions`, `GET /v1/decisions/:id` | FR-RAT-03, 04 | Must |
| 정확도 | `GET /v1/accuracy-stats` | FR-RAT-05, 06 | Must |
| 직접 거래 | `POST /v1/positions/:id/manual-notes`, `PATCH /v1/manual-notes/:id` | FR-MAN-03 | Could |
| 운영 | `GET /v1/risk-events` | POL-RISK-12 | Must |
| 선택 목록 | `GET /v1/bots/options` | FR-PERF-05 필터 | Must |

CSV 내려받기(FR-PERF-08)와 벤치마크 비교(FR-PERF-09)는 [미룬 것](#미룬-것)에 있어요.

## 공통

### `GET /v1/engine-status`

engine이 5초마다 쓰는 [`engine_status`](./data-model.md#engine_status)를 보여줘요. web은 모든 화면 머리에서 10초마다 불러, engine이 멈췄거나 정지 상태면 띠를 띄워요.

| 필드 | 설명 |
| --- | --- |
| `state` | `running` `stopping` `halted` (`halted`는 전체 정지: 킬 스위치·토큰·기록 실패) |
| `haltReasons` | 전체 정지 사유 코드 목록 |
| `heartbeatAt` | engine 마지막 기록 시각. **30초 넘게 오래되면 web이 "엔진 응답 없음"으로 표시**해요 |
| `staleSymbols` | 시세가 끊긴 종목 (`feed_stale`) |
| `marketOpen` | 오늘 정규장 여부와 시각 (`market_calendar`) |

### `POST /v1/commands`

봇 정지·재개·청산, 킬 스위치, 투자금 확대를 engine에 보내요. `command` 행을 넣고 같은 트랜잭션에서 `NOTIFY command`를 보내요 (201).

| `kind` | `botId` | 그 밖 | api가 먼저 막는 것 |
| --- | --- | --- | --- |
| `pause` | 필수 | | `stopped` 봇 |
| `resume` | 필수 | | 누적 손실 한도로 끝난 봇(POL-RISK-03). `waiting_funds` 봇의 `resume`은 지금 운용 자산으로 다시 확정을 시도해요 (POL-FUND-15, FR-BOT-10) |
| `liquidate` | 필수 | | `stopped` 봇 |
| `kill` | 없음 | `liquidateAll` | 없음. 언제나 받아요 |
| `expand_budget` | 필수 | | `stage ≠ released`, 보유 종목 있음 (POL-FUND-12) |

- 응답은 넣은 `command` 행이에요(`id`, `handledAt: null`). web은 `GET /v1/commands/:id`를 0.5초 간격으로 불러 `handledAt`·`result`를 확인해요. 킬 스위치는 1초 안에 `handledAt`이 차는 것이 정상이에요 (NFR-02)
- 같은 버튼을 두 번 눌러도 engine이 같은 결과를 내요([엔진 명령 처리](./engine.md#명령-처리-command)). api는 중복을 막지 않아요
- 킬 스위치를 누른 뒤 봇을 다시 돌리려면 봇마다 `resume`해요

## 홈 (F2)

### `GET /v1/home`

여러 feature를 묶는 통합 API라 `src/compositions/home/`에 둬요 (하네스 13절).

| 섹션 | 출처 |
| --- | --- |
| 계좌 | `engine_status`의 주문 가능 금액·평가금액·동기화 시각 |
| 오늘 손익 | 오늘 청산 포지션 실현 손익 + 보유 포지션 평가 손익(`quote_cache`). 직접 거래 포함, 검증 구간 봇 포함 (FR-PERF-10) |
| 봇 | 상태별 봇 수, 실행 중 봇 목록(이름·오늘 손익·상태) |
| 거래 | 오늘 체결된 주문 수 |

킬 스위치 버튼은 `POST /v1/commands`(`kind = kill`)를 불러요. 홈은 5초마다 다시 불러요.

## 봇 (F1)

### `GET /v1/bot-defaults?type&riskProfile`

유형·성향별 기본값(F1 1단계 자동 입력). 기본값은 코드 상수예요(`strategy` 기본 파라미터 + [POL-RISK-01](../policy/risk-management.md#1-투자-성향별-손실-중지-pol-risk-01) 손실 %). 이월 유형이면 갭 하락 안내가 필요하다는 표시를 같이 줘요 (FR-BOT-07).

### `POST /v1/allocation-previews`

저장 전에 예상 배분을 보여줘요 (FR-BOT-05). 몸체는 만들려는 봇의 투자금 설정, 응답은 같은 시각에 시작하는 봇 전체의 예상 확정 금액·보류 예정·미배분이에요.

- 운용 자산은 `engine_status`의 주문 가능 금액으로 [POL-FUND-02](../policy/fund-allocation.md#기본)를 계산해요. 실제 확정은 시작 시각 스냅샷으로 engine이 하므로 결과가 다를 수 있어서, 응답에 기준 시각을 넣어요
- 계산은 `fund` feature의 순수 함수(`*.rule.ts`)를 engine과 같이 써요. 미리보기와 실제 확정이 같은 계산이에요
- 생성이 아니라 계산이라 200이에요

### `POST /v1/bots`

`bot` + `bot_version`(v1, `change_kind = initial`)을 한 트랜잭션으로 저장해요 (201).

| 검사 | 근거 | 실패 코드 |
| --- | --- | --- |
| 정률 합 ≤ 100% (같은 시각 시작 봇) | POL-FUND-03 | `BUDGET_RATIO_EXCEEDED` |
| 운영 시간이 09:00~15:30 안, 시작 < 종료 | POL-RISK-15 | `TRADING_HOURS_OUT_OF_RANGE` |
| 규칙 파라미터 모양 (유형별 스키마) | FR-RAT-07 | `VALIDATION_FAILED` |

- `stage = verifying`, `status = ready`로 시작해요 (FR-BOT-02). 클라이언트는 둘을 보낼 수 없어요
- **시작은 engine이 해요.** engine은 `period_start`의 운영 시작 시각에 투자금을 확정하고 `running`으로 바꿔요. 이미 지난 시각이면 늦게 시작하는 봇으로 바로 확정해요 (POL-FUND-09)

### `GET /v1/bots`, `GET /v1/bots/:id`

목록은 이름·유형·성향·상태(사유 포함)·단계·확정 투자금·오늘 손익이에요. 상세는 여기에 더해 아래를 줘요.

- 현재 버전과 적용 대기 버전 (`applied_at` null)
- 자금: 확정 투자금, 사용 중 금액, 남은 한도, 누적 손익, 손실 중지까지 남은 여유 ([자금 정보 표시](../policy/fund-allocation.md#봇-화면에-표시할-자금-정보))
- 검증 구간이면 [상한 해제 기준](../policy/risk-management.md#9-검증-구간과-상한-해제-pol-risk-13)별 현재 값과 통과 여부 (FR-BOT-06)
- `waiting_funds`면 사유와 부족 금액 (FR-BOT-10)

### `PATCH /v1/bots/:id`

판단에 쓰이지 않는 설정만 바꿔요: 이름, 운용 종료일, 종료 시 처리, 시작 우선순위, 운영 시간. 투자금 설정(`budget_*`)은 `ready`·`waiting_funds`일 때만 바꿀 수 있어요 (`BOT_BUDGET_LOCKED`, F1 수용 기준). 운영 시간은 POST와 같이 검사해요. engine은 다음 주기에 `updated_at`을 보고 다시 읽어요.

### 규칙 값 버전

| 엔드포인트 | 하는 일 |
| --- | --- |
| `GET /v1/bots/:id/versions` | 버전 목록 (버전 번호, 변경 종류, 저장·적용 시각, 바뀐 값) |
| `POST /v1/bots/:id/version-previews` | 바꾸려는 값을 보내면 `change_kind`(`decision_change`·`risk_only`)와 그 결과(검증 구간 재시작 여부, 상한으로 다시 확정되는지)를 돌려줘요. 저장하지 않아요 (FR-BOT-11, 200) |
| `POST /v1/bots/:id/versions` | 새 버전을 `applied_at = null`로 추가해요 (201). 적용은 engine이 보유 종목이 없을 때 해요 (POL-RISK-13) |

- `change_kind`는 서버가 정해요. 손실 한도 조이기, 연속 손절 횟수 줄이기, 1회 주문 금액 줄이기**만** 바뀌면 `risk_only`, 그 밖에 하나라도 바뀌면 `decision_change`예요. 위험을 늘리는 쪽으로 바꾸는 것도 `decision_change`예요
- 적용 대기 버전이 있으면 새 버전을 더 넣지 않아요 (`BOT_VERSION_PENDING`). 대기 버전이 적용된 뒤에 다시 저장해요

### `POST /v1/bots/:id/release`

상한 해제 (FR-BOT-06). api가 기준을 계산해 모두 통과할 때만 `stage = released`로 바꿔요 (`RELEASE_CRITERIA_NOT_MET`). 투자금은 그대로이고, 늘리려면 이어서 `expand_budget` 명령을 보내요 (POL-FUND-12). 기준 계산은 `GET /v1/bots/:id`와 같은 함수예요.

### `GET /v1/bots/options`

필터용 봇 목록 `OptionDto[]` (`{ value: id, label: name }`). 종료된 봇도 내역 필터에 필요해서 모두 줘요 (하네스 13절). `/v1/bots/:id`보다 먼저 등록해 `options`가 id로 해석되지 않게 해요.

## 실적 (F2)

### `GET /v1/bot-stats?from&to`

봇 비교 표 (FR-PERF-02). 봇마다 한 줄: 수익률, 승률, 손익비, MDD, 평균 보유 시간, 거래 비용 합계. 직접 거래도 한 줄("직접 거래")로 넣어요(FR-MAN-05). 정렬은 web이 해요. 봇 수가 적어서 페이지를 나누지 않아요.

- 지표 정의는 [F2 핵심 지표](../product/features/f2-performance.md#봇별-핵심-지표)에만 있어요
- MDD·수익률은 `bot_daily_result`, 승률·손익비·보유 시간·비용은 청산 `position`으로 계산해요

### `GET /v1/bots/:id/daily-results?from&to`

일별 손익과 누적 곡선 (FR-PERF-03). `bot_daily_result`를 날짜순으로 줘요. 각 날짜에 그날 버전과 검증 구간 여부를 붙여, web이 검증 구간과 상한 해제 이후를 나눠 그려요 (FR-PERF-10). 기간 필터(일·주·월·전체)는 web이 `from`으로 바꿔 보내요.

### `GET /v1/positions`

투자 내역 (FR-PERF-04~07). 거래 1줄 = 포지션 1개.

| 쿼리 | 설명 |
| --- | --- |
| `from`, `to` | 진입일 기준 |
| `botIds` | 여러 개. `manual`을 넣으면 직접 거래 포함 |
| `symbol` | 종목 코드 |
| `result` | `profit` `loss` |
| `status` | `holding` `closed` `pending` `canceled` |
| `exitReasons` | 여러 개 |

- **상태**는 화면 값으로 바꿔 줘요: 보유 중(`open`, 수량 > 0), 미체결(`open`, 수량 0, 미체결 주문 있음), 청산 완료(`closed`), 취소(`closed`, `not_filled`)
- 보유 중은 페이지와 상관없이 맨 위에 고정해요(첫 페이지에 모두 넣어요, FR-PERF-06). 평가 손익은 `quote_cache` 가격으로 계산하고 가격 기준 시각을 같이 줘요. web은 보유 중이 있으면 5초마다 다시 불러요
- 정렬은 최신 진입순 하나예요

### `GET /v1/position-summaries`

내역 상단 요약. 쿼리는 `GET /v1/positions`와 같아요. `botIds`가 봇 하나면 봇별 탭 요약(확정 투자금, 사용 중 금액, 남은 한도, 누적 손익, 손실 중지까지 여유), 아니면 전체 탭 요약(거래 수, 순손익, 거래 비용, 봇별 손익 비중)을 줘요.

### `GET /v1/positions/:id`

펼친 거래 한 줄과 근거 카드예요.

- 주문 목록: 주문마다 방향·수량·상태·체결 합계(평균가·수량·수수료·세금), 출처(`bot`·`protective`·`manual`) (FR-PERF-04)
- 판단 목록: 진입·재평가·청산 판단을 시간순으로, 각 판단의 충족·탈락 조건, 점수, 예측 (F3 근거 카드)
- 채점: 판단별 `prediction_score` (FR-RAT-02). 아직 채점 전이면 비어 있어요
- 실제 결과: 청산가, 보유 시간, 보유 중 최고·최저가
- 직접 거래면 `manual_note`

## 근거 (F3)

### `GET /v1/decisions`

판단 목록. 주로 **건너뛴 판단**을 보는 데 써요 (FR-RAT-03, 04).

| 쿼리 | 설명 |
| --- | --- |
| `botIds`, `from`, `to`, `symbol` | |
| `kind` | `enter` `exit` `skip` `reeval` |
| `skipReasons` | 여러 개 |

건너뛴 판단은 `skip_followup`(종가, 이후 최고·최저)을 붙여 줘요. 장후 배치 전이면 비어 있어요.

### `GET /v1/decisions/:id`

판단 하나. 포지션에 붙은 판단이면 `positionId`를 줘서 web이 근거 카드(`GET /v1/positions/:id`)로 이동해요.

### `GET /v1/accuracy-stats?botIds&from&to`

정확도 분석 (FR-RAT-05, 06). 응답은 섹션별로 나눠요.

| 섹션 | 내용 | 우선 |
| --- | --- | --- |
| `summary` | 봇별 방향 적중률, 목표 도달률 평균, 평균 예측 오차 | Must |
| `scoreBuckets` | 신뢰 점수 구간(0~59, 60~69, 70~79, 80~89, 90~100)별 청산 수와 승률 | Must |
| `conditions` | 조건(규칙 id)별 충족 시 승률·평균 손익 | Should |
| `skipped` | 건너뛴 판단 사유별 수와 이후 평균 등락 | Should |
| `reeval` | 최초 판단 vs 재평가 판단 적중률 | Should |

Should 섹션은 구현 전까지 응답에서 빠져요(필드 없음). 나중에 필드를 더하는 것은 호환되는 변경이라 `/v2`가 필요 없어요.

## 직접 거래 (F4)

직접 거래 조회는 `GET /v1/positions?botIds=manual`과 `GET /v1/positions/:id`로 해요. 분류는 engine의 AccountSync가 해요 (FR-MAN-01, 02).

| 엔드포인트 | 하는 일 | 우선 |
| --- | --- | --- |
| `POST /v1/positions/:id/manual-notes` | 메모·목표가·손절가·예상 보유 시간 (201). 봇 포지션이면 `MANUAL_NOTE_NOT_ALLOWED` | Could |
| `PATCH /v1/manual-notes/:id` | 수정 | Could |

직접 거래 메모는 자유 문장을 허용해요(F4 예외). 채점은 숫자로만 해요.

## 운영

### `GET /v1/risk-events?botIds&kinds&from&to`

리스크·장애 이벤트와 알림 발송 여부 (POL-RISK-12). 최신순, 페이지 나눔.

## 에러 코드

하네스 공통 코드(`VALIDATION_FAILED`, `HTTP_401` 등) 외에 이 서비스가 쓰는 비즈니스 코드예요.

| 코드 | 상태 | 언제 |
| --- | --- | --- |
| `BOT_NOT_FOUND` | 404 | 없는 봇 |
| `POSITION_NOT_FOUND` | 404 | 없는 포지션 |
| `DECISION_NOT_FOUND` | 404 | 없는 판단 |
| `COMMAND_NOT_FOUND` | 404 | 없는 명령 |
| `BUDGET_RATIO_EXCEEDED` | 422 | 정률 합 100% 초과 (POL-FUND-03) |
| `TRADING_HOURS_OUT_OF_RANGE` | 422 | 운영 시간이 정규장 밖 (POL-RISK-15) |
| `BOT_BUDGET_LOCKED` | 409 | 실행 중 봇의 투자금 수정 |
| `BOT_VERSION_PENDING` | 409 | 적용 대기 버전이 이미 있음 |
| `RELEASE_CRITERIA_NOT_MET` | 422 | 상한 해제 기준 미달 (POL-RISK-13). 미달 기준 목록을 `detail`에 |
| `COMMAND_NOT_ALLOWED` | 409 | 지금 봇 상태에서 받을 수 없는 명령 ([명령 표](#post-v1commands)) |
| `MANUAL_NOTE_NOT_ALLOWED` | 422 | 봇 포지션에 직접 거래 메모 |

- 422는 입력은 맞지만 정책에 어긋날 때, 409는 지금 상태와 충돌할 때예요
- engine이 실행 단계에서 거부한 명령은 HTTP 에러가 아니라 `command.result = failed`, `command.error`로 알려요

## engine이 api를 위해 쓰는 것

api가 토스를 부르지 않으므로, 화면에 필요한 실시간 값은 engine이 DB에 써요 ([엔진 설계](./engine.md#화면용-상태-쓰기)).

| 표 | 쓰는 주기 | 쓰는 화면 |
| --- | --- | --- |
| [`engine_status`](./data-model.md#engine_status) | 5초 | 머리 띠, 홈 계좌, 배분 미리보기 |
| [`quote_cache`](./data-model.md#quote_cache) | 5초 (보유 종목만) | 보유 중 평가 손익 |

## 미룬 것

| 항목 | 이유 | 다시 볼 때 |
| --- | --- | --- |
| CSV 내려받기 (FR-PERF-08, Should) | `GET /v1/positions`와 같은 필터로 만들면 돼요. 형식(같은 경로의 `Accept: text/csv` 또는 별도 경로)은 만들 때 정해요 | M4 |
| 벤치마크 비교 (FR-PERF-09, Should) | 코스피·코스닥 일별 지수를 저장하는 곳이 아직 없어요. engine 장후 배치에서 지수를 받아 저장하는 표가 먼저 필요해요 | M4 |
| 직접 보유 가격 알림 (FR-MAN-04, Could) | 알림은 engine이 보내요. API는 `manual_note`의 목표가·손절가로 충분해요 | 백로그 |
| 과거 주문 가져오기 (FR-MAN-06, Could) | engine 일회성 작업이라 API가 필요 없어요 | 백로그 |

## 테스트로 고정할 시나리오

하네스 규칙대로 service 단위 테스트 + e2e로 써요.

1. 같은 시각에 시작하는 정률 봇 합이 100%를 넘으면 `POST /v1/bots`가 422 `BUDGET_RATIO_EXCEEDED`다
2. 운영 시간 08:50~15:00은 422 `TRADING_HOURS_OUT_OF_RANGE`다
3. 실행 중 봇의 `budget_amount` PATCH는 409 `BOT_BUDGET_LOCKED`다
4. 손실 한도만 낮춘 버전 미리보기는 `risk_only`, 진입 값 하나라도 바꾸면 `decision_change`다. 손실 한도를 높여도 `decision_change`다
5. 기준 하나라도 미달인 봇의 `release`는 422이고 `stage`가 바뀌지 않는다
6. `POST /v1/commands`(`kill`)는 `command` 행과 `NOTIFY`를 한 트랜잭션으로 남긴다. 롤백되면 둘 다 없다
7. 보유 종목이 있는 봇의 `expand_budget`은 409 `COMMAND_NOT_ALLOWED`다
8. `GET /v1/positions`는 보유 중 포지션을 첫 페이지 맨 위에 둔다
9. 판단·주문·체결을 바꾸거나 지우는 경로가 없다 (`openapi.json` 경로 목록 검사)
10. 토큰 없이 부르면 `GET /health`를 뺀 모든 경로가 401이다 (하네스 `auth-guard.e2e-spec.ts`)
