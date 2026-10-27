# 시스템 개요

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27
> 관련: [데이터 모델](./data-model.md) · [ADR](./adr/) · [토스 API 연동](../integrations/toss-securities-api.md)

## 구성

```
               ┌──────────────── engine 프로세스 ────────────────┐
토스 API ◀──▶ │ TossClient (토큰 1개, API 그룹별 rate limiter)    │
               │   ├─ MarketCollector  웹소켓 1개로 시세 수집 → 메모리 스냅샷
               │   ├─ AccountSync      personal:order 이벤트 + 주문·잔고 REST 재동기화
               │   └─ Broker           TossBroker(실전) | PaperBroker(개발 점검)
DART API  ◀──  │ DartClient (장전 점검용 공시 목록)                 │
               │                                                   │
               │ BotRunner      봇마다 주기 실행 (아래 8단계)          │
               │ Scheduler      재평가·장전 점검·장후 집계 배치          │
               │ Notifier       텔레그램 알림                         │
               └──────────────────────┬────────────────────────────┘
                                      │ PostgreSQL (+ LISTEN/NOTIFY: 정지·청산 명령)
               ┌──────────────────────┴───────────┐
               │ api 프로세스  조회 · 봇 설정 · 명령 │ ◀── web (Next.js)
               └──────────────────────────────────┘
```

| 구성 요소 | 책임 | 관련 결정 |
| --- | --- | --- |
| engine | 장중 매매 루프, 배치, 외부 API 호출 전부 | [ADR-0002](./adr/0002-split-api-and-engine.md) |
| api | 웹 화면용 조회, 봇 설정 저장, 명령 전달 (토스 API 직접 호출 안 함) | [ADR-0002](./adr/0002-split-api-and-engine.md) |
| web | 화면 (F1~F4) | [ADR-0001](./adr/0001-tech-stack.md) |
| PostgreSQL | 모든 상태의 단일 출처, 프로세스 간 명령 전달 | [ADR-0004](./adr/0004-postgres-notify-for-commands.md) |

## 봇 실행 흐름 (8단계)

봇은 장중에 아래 순서를 반복하고, **판단 시점에 근거와 예측을 먼저 저장한 뒤에만 주문**을 내요 ([ADR-0003](./adr/0003-record-decision-before-order.md)).

| 단계 | 하는 일 | 실패하면 |
| --- | --- | --- |
| ① 시세 읽기 | 공용 수집기의 메모리 스냅샷을 읽음 (봇이 API를 직접 부르지 않음) | 스냅샷이 오래됐으면 이번 주기 건너뜀 |
| ② 규칙 평가 | 유형별 규칙 함수로 충족·탈락 조건, 신뢰 점수, 예측을 계산 | — |
| ③ 리스크·자금 검사 | [리스크 관리](../policy/risk-management.md)(매매 시간·종목 잠금 포함), [자금 배분](../policy/fund-allocation.md) 정책 검사 | 통과 못 하면 "건너뛴 판단"으로만 기록 |
| ④ 판단 기록 | 근거 카드를 DB에 저장 | 저장 실패 시 주문하지 않고 신규 진입 중단 + 알림 |
| ⑤ 주문 | Broker로 주문, `clientOrderId = 판단 기록 id`, 응답의 `orderId` 저장 | 10분 안에서만 같은 id로 재시도. 422·409 거부는 재시도 없이 건너뜀 기록 |
| ⑥ 체결 반영 | `personal:order` 이벤트로 체결을 반영하고, 주문 조회의 체결 합계(수수료·세금 포함)로 확정. 실전 진입 체결 직후 손절 조건주문 등록 | 불일치 시 주문 조회 결과를 정답으로 보정 |
| ⑦ 청산 판단 | 청산 조건, 손실 한도, 장 마감 시각 확인 → 손절 조건주문 취소 후 ②~⑤로 매도 ([POL-RISK-14](../policy/risk-management.md#7-1-손절-조건주문과-봇-매도의-순서-pol-risk-14)) | — |
| ⑧ 채점 | 청산된 포지션의 예측 vs 실제 채점 | 장후 배치에서 재시도 |

시세는 공용 수집기 한 곳에서 받아 여러 봇이 나눠 쓰므로 API 호출 한도를 아껴요 ([ADR-0007](./adr/0007-single-market-collector.md)).

## 설계 원칙

1. **규칙은 순수 함수**: `evaluate(type, params, snapshot) → { passed, failed, score, prediction }`. 실전·개발 점검·백테스트가 같은 함수를 써요 ([ADR-0005](./adr/0005-in-house-paper-broker.md))
2. **불확실하면 멈춤**: 시세·잔고·DB 중 하나라도 이상하면 신규 진입을 멈춰요 ([NFR-01](../product/prd.md#7-비기능-요구사항))
3. **기록은 추가만**: 근거·주문·체결은 수정·삭제하지 않아요 ([NFR-04](../product/prd.md#7-비기능-요구사항))
4. **외부 API는 한 곳**: 토스 API 호출은 engine의 TossClient만 해요. 스펙이 바뀌어도 고칠 곳이 하나예요

## 일일 일정 (engine)

| 시각 | 작업 |
| --- | --- |
| 08:30 | 토큰 확인·재발급, 당일 장 캘린더·상하한가·수수료율 로드, 웹소켓 연결, 장전 점검 배치 (이월 봇: DART 공시, 미국 ETF·환율, NXT 프리마켓 가격) |
| 09:00~09:05 | 개장 직후 점검 (이월 봇: 실제 시초가로 갭 대응 확정) |
| 08:59 | 09:00 시작 봇들의 운용 자산 스냅샷 |
| 09:00~15:30 | BotRunner 루프, AccountSync (이벤트 + 주기 재동기화). 매매는 정규장만 ([POL-RISK-15](../policy/risk-management.md#4-1-매매-시간-pol-risk-15)) |
| 11:00, 14:00 | 장중 점검 (스윙) |
| 15:40 | 장후 재평가 (이월 봇), 체결 최종 동기화, 건너뛴 판단의 이후 가격 채우기, 일일 집계 |
| 금 장후 | 주간 점검 (스윙) |

## 배포

고정 IP VM 1대에 Docker Compose로 `api`, `engine`, `web`, `postgres`를 띄워요. 토스 허용 IP에 이 VM의 IP를 등록해요. 관리 화면 접근은 [ADR-0006](./adr/0006-network-level-access-control.md)을 따라요.
