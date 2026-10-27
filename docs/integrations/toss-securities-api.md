# 토스증권 오픈API 연동

> 상태: 확인됨 (공식 문서 기준, 2026-10-26) · 담당: @소닉 · 최종 수정: 2026-10-27
> 관련: [시스템 개요](../architecture/overview.md) · [ADR-0007](../architecture/adr/0007-single-market-collector.md) · [미결정 사항](../project/open-questions.md)

## 공식 문서

| 문서 | 용도 |
| --- | --- |
| [개발자 사이트](https://developers.tossinvest.com/docs#description/introduction) | 사람이 보는 API 레퍼런스 |
| [Overview](https://openapi.tossinvest.com/openapi-docs/overview.md) | 기능 목록, 호출 한도, 에러 모델, 웹소켓 연동 |
| [OpenAPI JSON](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) | REST 엔드포인트·스키마의 **정답 출처**. 클라이언트 타입 생성에 사용 |
| [AsyncAPI JSON](https://openapi.tossinvest.com/openapi-docs/latest/asyncapi.json) | 웹소켓 채널·메시지의 정답 출처 |
| [FAQ](https://openapi.tossinvest.com/openapi-docs/faq.md) | 자주 묻는 동작 규칙 |

구체적인 한도 수치는 사전 공지 없이 바뀔 수 있어요. 코드는 이 문서의 숫자를 상수로 박지 않고 응답 헤더 `X-RateLimit-*`를 따라요.

## 인증

| 항목 | 내용 | 우리 쪽 영향 |
| --- | --- | --- |
| 방식 | OAuth 2.0 Client Credentials. `POST /oauth2/token` | |
| 키 발급 | 토스증권 WTS > 설정 > Open API에서 `client_id`·`client_secret` 발급 | |
| 허용 IP | 같은 화면에서 등록. 미등록 IP는 REST 403 `ip-not-allowed`, 웹소켓 연결 403 | 고정 IP 서버 필요. 개발 PC도 등록해야 호출 가능 |
| 토큰 수명 | 응답의 `expires_in`(초). refresh token 없음, 만료 시 재발급 | 만료 전에 재발급 |
| **토큰 개수** | **클라이언트당 유효 토큰 1개.** 새로 발급하면 이전 토큰은 즉시 `401 token-revoked` | 토큰은 engine 한 곳에서만 발급. 개발 환경이 같은 키로 발급하면 운영 토큰이 끊김 ([R-014](../project/risks.md)) |
| 계좌 헤더 | 계좌·자산·주문·조건주문 API는 `X-Tossinvest-Account: {accountSeq}` 필요 | `GET /api/v1/accounts`로 accountSeq를 얻어 설정에 저장 |

## 사용할 API

| 용도 | 엔드포인트 | 한도 그룹 |
| --- | --- | --- |
| 실시간 체결·호가 | 웹소켓 `trade:kr`, `orderbook:kr` | 웹소켓 한도 (아래) |
| 실시간 내 주문 이벤트 | 웹소켓 `personal:order` | 웹소켓 한도 |
| 현재가·호가·최근 체결 (보조) | `GET /api/v1/prices`, `/orderbook`, `/trades` | `MARKET_DATA` |
| 분봉·일봉 | `GET /api/v1/candles` (1m·1d, 최대 200개/회) | `MARKET_DATA_CHART` |
| 상·하한가 | `GET /api/v1/price-limits` | `MARKET_DATA` |
| 거래대금·거래량·등락률 순위 | `GET /api/v1/rankings` | `RANKING` |
| 지수 (벤치마크, 시장 상황) | `GET /api/v1/market-indicators/prices`, `/{symbol}/candles`. 지원 심볼은 `KOSPI`, `KOSDAQ`, `KR_BOND_*` 8종뿐 | `MARKET_INDICATOR_*` |
| 미국 증시 신호 (장전 점검) | `GET /api/v1/candles`로 대표 ETF(SPY, QQQ, SOXX) 일봉 → 전일 정규장 등락률. 미국 일봉 종가는 정규장 공식 종가 | `MARKET_DATA_CHART` |
| 원/달러 환율 (장전 점검) | `GET /api/v1/exchange-rate` | `MARKET_INFO` |
| 종목 정보·거래정지 | `GET /api/v1/stocks` (`koreanMarketDetail.krxTradingSuspended`, `liquidationTrading`) | `STOCK` |
| 매수 유의사항 (VI 등) | `GET /api/v1/stocks/{symbol}/warnings` | `STOCK` |
| 장 운영 캘린더 | `GET /api/v1/market-calendar/KR` (`integrated`가 null이면 휴장) | `MARKET_INFO` |
| 보유 주식 | `GET /api/v1/holdings` | `ASSET` |
| 매수 가능 금액 | `GET /api/v1/buying-power` (`cashBuyingPower`, 미수 미발생 기준) | `ORDER_INFO` |
| 수수료율 | `GET /api/v1/commissions` | `ORDER_INFO` |
| 주문 생성·정정·취소 | `POST /api/v1/orders`, `/{orderId}/modify`, `/{orderId}/cancel` | `ORDER` |
| 주문 조회 | `GET /api/v1/orders` (OPEN 전량 / CLOSED 최대 100건·cursor), `/{orderId}` | `ORDER_HISTORY` |
| 조건주문 | `POST/DELETE /api/v1/conditional-orders` 등 | `CONDITIONAL_ORDER*` |

## 호출 한도 (REST, 클라이언트 × 그룹, 초당)

| 그룹 | 한도 | 09:00~09:10 |
| --- | --- | --- |
| `AUTH` | 5 | |
| `ACCOUNT` | 1 | |
| `ASSET` | 5 | |
| `STOCK` | 5 | |
| `MARKET_INFO` | 3 | |
| `MARKET_DATA` | 15 | |
| `MARKET_DATA_CHART` | 20 | |
| `RANKING` | 5 | |
| `ORDER` | 10 (매수·매도 합산) | 10 |
| `ORDER_HISTORY` | 5 | |
| `ORDER_INFO` | 6 | **3** |
| `CONDITIONAL_ORDER` | 5 | |
| `CONDITIONAL_ORDER_HISTORY` | 10 | |

- 응답 헤더: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, 429일 때 `Retry-After`
- 429 대응: `Retry-After`만큼 대기, 지수 백오프 + jitter
- 원본 기획의 "오전 9시대 전체 한도 축소"는 사실과 달라요. 09:00~09:10에 `ORDER_INFO`만 3회로 줄어요
- **어뷰징 제한**: 짧은 시간에 대량 주문을 반복하면(예: 소액 주문을 수십 분 내 수백 건) 일정 시간 매매가 제한되고, 반복되면 기간이 늘어요 → [POL-RISK-08](../policy/risk-management.md)

## 웹소켓

| 항목 | 내용 |
| --- | --- |
| 주소 | `wss://openapi-ws.tossinvest.com/ws/v1`, 연결 시 `Authorization: Bearer` 헤더 |
| 채널 | `trade:kr`(체결 틱), `orderbook:kr`(호가 전체 스냅샷), `personal:order`(내 주문 이벤트) |
| 구독 방식 | 선언형. JSON 배열 하나가 현재 구독 전체이고, 새 배열이 기존 구독을 통째로 대체 |
| 동시 연결 | **계정당 2개.** 초과하면 가장 오래된 연결이 끊김 |
| 구독 수 | 연결당 100건 (채널 × 종목 조합) |
| 선언 빈도 | 초당 5회 |
| 연결 유지 | 클라이언트가 180초간 아무것도 안 보내면 서버가 끊음. 60초 간격 `PING` 권장 |
| 전달 보장 | 시세는 LOSSY(밀리면 중간 프레임 유실, sequence 없음). 주문은 연결 세션 안에서만 LOSSLESS. 끊긴 동안의 주문 이벤트는 재전송되지 않으므로 재연결 후 `GET /api/v1/orders`로 재동기화 |
| 배포 시 | `server-shutdown` 프레임 후 끊김 → 재연결·재선언 |

국내 시세는 KRX + NXT 통합 시세만 제공해요.

## 주문 규칙

| 규칙 | 내용 | 우리 쪽 영향 |
| --- | --- | --- |
| 호가 유형 | `LIMIT`, `MARKET`. `timeInForce`: `DAY`(기본, 정규장 종료 시 미체결 자동 취소), `OPG`(국내 시가단일가) | |
| `clientOrderId` | 선택. 최대 36자, 영숫자·`-`·`_`. **멱등 유효 10분.** 같은 값·같은 내용 재요청 시 첫 결과 반환, 처리 중이면 `409 request-in-progress`, 내용이 다르면 `422 idempotency-key-conflict` | 판단 id를 UUID(36자)로 만들어 그대로 사용. 10분이 지난 재시도는 먼저 주문 조회로 존재 여부 확인 ([ADR-0003](../architecture/adr/0003-record-decision-before-order.md)) |
| **반대 방향 미체결** | 국내 주식은 같은 종목에 반대 방향 미체결 주문이 있으면 가격과 무관하게 `409 opposite-pending-order-exists` | 같은 종목을 여러 봇·직접 거래가 동시에 다루면 서로 막힘 → 종목 잠금 ([POL-RISK-16](../policy/risk-management.md#5-1-종목-잠금-pol-risk-16)) |
| 고액 주문 | 1억 원 이상은 `confirmHighValueOrder: true` 필요 | 봇 주문은 이 플래그를 보내지 않아, 1억 원 이상 주문은 거부되게 둠 (안전장치) |
| 주문 가능 시간 | 앱과 동일. 불가 시간에는 `422 order-hours-closed` | |
| 정정 | 국내는 가격·수량 정정 가능 | |
| 거래 제한 | `stock-restricted`, `price-out-of-range`, `insufficient-buying-power` 등 422 | 재시도하지 않고 판단을 건너뜀으로 기록 |

## 주문·체결 조회

- 앱·WTS에서 낸 주문도 채널과 무관하게 조회돼요. 단, 장전·장후 시간외 종가처럼 Open API가 지원하지 않는 호가 유형은 빠져요
- 조회 기간은 **계좌 개설 이후 전체**예요 (Q-003)
- **주문 1건이 1행**이에요. 분할 체결은 평균 체결가·총 체결 수량으로 합산되고, 체결 시각은 마지막 체결 기준이에요. 체결 건별 REST 조회는 없고, 건별 이벤트는 웹소켓 `personal:order`로만 받아요
- 주문 응답의 체결 결과(`execution`)에 `commission`, `tax`, `settlementDate`가 함께 와요 → 실전 순손익은 이 값을 써요 ([NFR-05](../product/prd.md#7-비기능-요구사항))
- 주문 응답에는 `clientOrderId`가 없어요. 봇 주문 구분은 주문 생성 시 받은 `orderId`로 해요

## 조건주문

| 항목 | 내용 |
| --- | --- |
| 타입 | `SINGLE`(조건 1개, `LIMIT`·`MARKET`, 매수·매도), `OCO`(매도 2개 중 하나 발동 시 나머지 취소, `LIMIT`만), `OTO`(매수 체결 후 매도 감시 시작, `LIMIT`만) |
| 개수 제한 | `OCO`·`OTO`는 **종목당 1개**, `SINGLE`은 제한 없음 |
| 만료 | `expireDate` 필수, 오늘부터 최대 1년 |
| **발동 세션** | **국내는 KRX 정규장에서만 발동** |
| 수정 | 취소 후 재생성 방식이라 새 `conditionalOrderId`가 발급됨 |
| 멱등 | `clientOrderId` 지원 (주문 생성과 동일) |
| 반대 방향 제한 | 일반 주문의 `opposite-pending-order-exists` 제한을 받지 않음 |

손절 안전망은 `SINGLE` + `MARKET` + `SELL`로 걸어요. 종목당 개수 제한이 없어 여러 봇이 각자 걸 수 있어요 ([POL-RISK-11](../policy/risk-management.md)).

## 매수 유의사항·거래 제한 판별

| 판별 대상 | 출처 |
| --- | --- |
| VI 발동 | warnings `VI_STATIC`, `VI_DYNAMIC`, `VI_STATIC_AND_DYNAMIC` |
| 투자경고·투자위험·단기과열 | warnings `INVESTMENT_WARNING`, `INVESTMENT_RISK`, `OVERHEATED` |
| 정리매매 | warnings `LIQUIDATION_TRADING` 또는 stocks `liquidationTrading` |
| 거래정지 | stocks `krxTradingSuspended`, `nxtTradingSuspended` |
| 관리종목 | **제공 필드 없음** → MVP에서는 거르지 않음, 외부 수집은 백로그 ([Q-012](../project/open-questions.md#q-012)) |

warnings의 `warningType`은 새 값이 추가될 수 있어요. 모르는 값은 "진입 금지"로 처리해요.

## 시세 데이터 특성

- 1분봉 과거 데이터: 국내 2022-11-23 이후. 일봉은 기간 제한 없음 → 백테스트용 데이터 확보 가능
- 1분봉 `timestamp`는 봉 **종료** 시각. 시가 단일가(09:00)는 `09:01` 봉에 들어가요
- 체결 없는 분은 거래량 0 봉으로 채워져요 (VI·거래정지 중에도 발생)
- 진행 중인 봉은 값이 계속 바뀌어요. 판단에는 완성된 봉만 써요
- 실시간 호가는 매번 전체 스냅샷이에요. 통합 호가라 매도 1호가가 매수 1호가 이하로 보일 수 있어요

## 모의투자

공식 문서에 API용 모의투자(샌드박스) 환경은 없어요. 엔진 개발 점검용 모의 체결은 자체 구현해요 ([ADR-0005](../architecture/adr/0005-in-house-paper-broker.md)). 사용자용 모의 모드는 없어요 ([Q-018](../project/open-questions.md#q-018)).

## 데이터 이용 정책

API로 받은 정보는 **투자자 본인의 매매 목적**으로만 쓸 수 있어요. 비상업적이어도 제3자 배포는 금지예요. 이 서비스의 화면·리포트는 본인만 보도록 유지해요 ([ADR-0006](../architecture/adr/0006-network-level-access-control.md)).

## 남은 확인 (실제 호출로)

- [ ] 고정 IP 서버에서 토큰 발급 → 계좌 조회 → 잔고 조회 1회 성공
  - 2026-10-27 개발 PC(허용 IP 등록)에서는 성공 (`spikes/m0/toss-spike.mjs rest`). 고정 IP 서버에서 다시 확인 필요
- [x] `expires_in` 실제 값 확인 후 재발급 주기 결정 → **86400초(24시간)** (2026-10-27). 하루 1회, 장 시작 전에 재발급하면 장중 토큰 교체가 없어요
  - 함께 확인: 응답 헤더 `X-RateLimit-*`가 실제로 옴 (`ACCOUNT` 1, `ORDER_INFO` 6, `ASSET` 5로 문서 한도와 일치). 보유 조회 `items[].cost`에 매도 시 예상 `commission`·`tax`가 있음
- [ ] `cashBuyingPower`가 미체결 매수 주문 금액을 이미 빼고 주는지, 당일 매도 대금(D+2 미결제)을 포함하는지 확인. 운용 자산 계산식(POL-FUND-02)의 전제예요
- [ ] 웹소켓 연결 → `trade:kr` 구독 → PING 유지 1시간
  - 2026-10-27 장 마감 후: 헤더 인증 연결, 구독 ack(`subscribed`), `PING` → `pong` 확인. 체결 수신과 1시간 유지는 장중에 다시 확인 (`spikes/m0/toss-spike.mjs ws`)
- [ ] `personal:order` 이벤트 형태를 소액 지정가 주문·취소로 확인 (M5 소액 실전 전)
- [ ] NXT 거래 종목의 08:00~08:50 프리마켓 체결이 통합 현재가(`prices`)에 반영되는지 확인. 반영되지 않으면 장전 갭 추정은 생략하고 개장 직후 점검만 써요 ([POL-REEV-06](../policy/position-reevaluation.md#장전-점검과-개장-직후-점검-pol-reev-06))
- [ ] 예상 체결가 필드는 없음(2026-10-26 확인). 동시호가 중 호가 응답의 의미는 판단에 쓰지 않아요 ([ADR-0008](../architecture/adr/0008-external-data-numeric-only.md))

## 우리 쪽 사용 원칙

| 원칙 | 내용 |
| --- | --- |
| 호출 지점은 하나 | engine의 `TossClient`만 토스 API를 불러요. 토큰 발급도 engine만 해요 ([ADR-0002](../architecture/adr/0002-split-api-and-engine.md)) |
| 한도 관리 | 그룹별 토큰 버킷, 실제 한도는 응답 헤더로 갱신 |
| 재시도 | 조회는 백오프 재시도. 주문은 같은 `clientOrderId`로 10분 안에서만 재시도 |
| 웹소켓 연결 | engine이 1개만 사용하고, 1개는 예비로 남겨요 (개발·점검용) |
| 비밀값 | `client_id`·`client_secret`은 환경변수로 주입, 저장소 금지 ([NFR-06](../product/prd.md#7-비기능-요구사항)) |
| 타입 | OpenAPI JSON에서 TypeScript 타입을 생성해 써요. 모르는 enum 값을 허용하도록 처리해요 |
| 테스트 | OpenAPI 예제 응답 기반 가짜 서버로 단위·통합 테스트 |
