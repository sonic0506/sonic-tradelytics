# 데이터 모델 (초안)

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27
> 관련: [시스템 개요](./overview.md) · [자금 배분](../policy/fund-allocation.md) · [F3 근거 리포트](../product/features/f3-rationale-report.md)

컬럼은 개념 수준이에요. 실제 타입·인덱스는 migration을 만들 때 확정해요.

## 공통 규칙

- 금액은 원 단위 정수(`bigint`), 비율은 `numeric`
- 시각은 `timestamptz`로 저장하고 화면에서 Asia/Seoul로 표시
- `decision`, `order_event`, `prediction_score`, `risk_event`는 추가만 해요 (수정·삭제 없음, [NFR-04](../product/prd.md#7-비기능-요구사항)). 주문 상태·체결 변화는 `order_event`로 쌓고, `order`의 체결 합계 컬럼만 최신값으로 갱신해요
- 토스는 체결을 주문 단위 합계로만 조회해 줘요. 그래서 별도 체결(fill) 테이블 대신 `order`에 체결 합계를 두고, 건별 체결은 웹소켓 이벤트를 `order_event`에 남겨요

## 엔티티 관계

```
account_snapshot 1─* allocation *─1 bot 1─* bot_version 1─* decision 1─0..1 order 1─* order_event
position *─* decision (진입·청산·재평가)        position 1─* prediction_score
position 1─* protective_order (손절 조건주문)    position 1─0..1 manual_note (직접 거래)
bot 1─* risk_event                              symbol_lock *─1 bot (POL-RISK-16)
```

## 테이블

| 테이블 | 주요 컬럼 | 비고 |
| --- | --- | --- |
| `account_snapshot` | taken_at, orderable_cash, running_bots_cash_share, available_capital | 배분 기준 스냅샷. available_capital = orderable_cash − running_bots_cash_share (POL-FUND-01, 02, 07) |
| `bot` | name, type, stage(verifying/released), risk_profile, status(…/waiting_funds), budget_type(ratio/fixed), budget_value, start_priority, period_start, period_end, on_period_end, schedule | 정률·정액 설정과 시작 우선순위 (POL-FUND-13~15). stage는 POL-RISK-13 |
| `bot_version` | bot_id, version, params(jsonb), resets_verification, created_at | 규칙 변경마다 새 버전 (FR-BOT-03). resets_verification은 판단이 바뀌는 변경이면 true (POL-RISK-13) |
| `allocation` | bot_id, snapshot_id, ratio, fixed_budget, capped(bool), released_at, released_amount | 확정 투자금과 반환 기록 (POL-FUND-04, 06). capped는 검증 구간 상한이 적용됐는지 (POL-FUND-11). 상한 해제 후 확대 시 기존 행을 반환하고 새 행을 추가 (POL-FUND-12) |
| `decision` | id(UUID), bot_version_id, symbol, at, price, kind(enter/exit/skip/reeval), passed(jsonb), failed(jsonb), score, prediction(jsonb), skip_reason | 근거 카드의 원본. id가 clientOrderId |
| `order` | decision_id, side, qty, price, order_type, time_in_force, broker_order_id, status, filled_qty, avg_filled_price, filled_amount, commission, tax, filled_at, settlement_date | 체결 합계는 토스 주문 조회의 `execution` 값 그대로 (NFR-05). `broker_order_id`로 봇 주문 식별 |
| `order_event` | order_id, status, at, filled_qty_delta, price, source(ws/rest), raw(jsonb) | 웹소켓 `personal:order` 이벤트와 REST 재동기화 결과 |
| `protective_order` | position_id, broker_conditional_order_id, trigger_price, qty, expire_date, status(open/canceled/triggered/expired) | 손절 조건주문 (POL-RISK-11, 14). 수정 시 새 id가 발급되므로 행을 새로 추가 |
| `symbol_lock` | symbol, bot_id, acquired_at, released_at | 종목 잠금 (POL-RISK-16). 해제 전 행은 종목당 1개만 허용(부분 유니크 인덱스) |
| `position` | bot_id(null이면 직접 거래), symbol, qty, opened_at, closed_at, exit_reason, net_pnl | 거래 1줄 = 포지션 1개 |
| `prediction_score` | position_id, decision_id, direction_hit, target_reach, error_pct | 최초·재평가 각각 채점 (POL-REEV-04) |
| `skip_followup` | decision_id, price_after_close, max_after, min_after | 건너뛴 판단의 이후 가격 (FR-RAT-04) |
| `risk_event` | bot_id, kind(daily_stop/total_stop/streak_pause/rate_cap/kill_switch/batch_fail), at, detail | |
| `manual_note` | position_id, memo, target, stop, horizon | 직접 거래 근거 (F4) |
| `command` | kind(pause/resume/liquidate/kill), bot_id, requested_at, handled_at | api → engine 명령 ([ADR-0004](./adr/0004-postgres-notify-for-commands.md)) |
| `disclosure` | rcept_no(PK), stock_code, pblntf_ty, report_nm, rcept_dt, fetched_at | DART 공시. 장전 점검의 공시 경계 근거 ([DART 연동](../integrations/dart-open-api.md)) |
| `fee_schedule` | effective_from, commission_rate, tax_rate | 개발 점검용 PaperBroker 체결 계산에 써요. 수수료율은 토스 `commissions` API에서 채움 |
| `market_calendar` | date, is_open, regular_open_at, regular_close_at | 토스 `market-calendar/KR`. `integrated`가 null이면 휴장 |

## 기록량 관리

`decision(kind=skip)`은 많이 쌓여요. **종목 필터를 통과한 후보 중 진입 조건에서 떨어진 것과 리스크·자금 검사에서 막힌 것만** 기록하고, 이후 가격 추적은 장후 배치에서 한 번에 채워요.
