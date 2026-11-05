-- 개발 점검(PaperBroker, 로드맵 M3) 통과 기준을 거래일별로 보여 줘요. 데이터는 읽기만 하고 _paper DB에서만 돌아요.
--   docker exec -i sonic-tradelytics-db psql -U postgres -d tradelytics_paper -v ON_ERROR_STOP=1 < scripts/paper-report.sql
-- ponytail: 배치 사이의 짧은 재시작은 DB에 남지 않아요. 무중단은 engine 로그와 함께 봐요.

DO $$
BEGIN
  IF current_database() NOT LIKE '%\_paper' THEN
    RAISE EXCEPTION 'paper 리포트는 _paper DB에서만 돌려요 (지금: %)', current_database();
  END IF;
END $$;

SET timezone = 'Asia/Seoul';
\pset footer off

CREATE TEMP VIEW report_days AS
WITH today AS (SELECT now()::date AS d),
-- 엔진이 꺼진 날은 달력 행이 없어요. 평일을 직접 늘어놓아 그런 날도 실패로 잡아요
days AS (
  SELECT g::date AS d
  FROM generate_series((SELECT min(trade_date) FROM market_calendars), (SELECT d FROM today), interval '1 day') g
  LEFT JOIN market_calendars c ON c.trade_date = g::date
  WHERE extract(isodow FROM g) < 6 AND c.is_open IS DISTINCT FROM false
),
batches AS (
  SELECT trade_date AS d, count(*) FILTER (WHERE result = 'ok') AS ok,
         bool_or(job = 'post_close') AS closed
  FROM batch_runs WHERE job IN ('pre_open', 'open_snapshot', 'post_close') GROUP BY 1
),
risks AS (
  SELECT occurred_at::date AS d, count(*) AS n FROM risk_events
  WHERE kind IN ('bot_error', 'record_fail') GROUP BY 1
),
pos AS (
  SELECT opened_at::date AS d, count(*) AS n, sum(realized_pnl) AS pnl, sum(total_fees) AS fees,
         count(*) FILTER (WHERE status = 'closed' AND realized_pnl > 0) AS wins,
         count(*) FILTER (WHERE status = 'closed') AS closed,
         count(*) FILTER (WHERE status <> 'closed') AS open
  FROM positions GROUP BY 1
),
-- 포지션 하나에 진입 매수 주문이 둘 이상 (리플레이 점검과 같은 기준)
repeats AS (
  SELECT d, count(*) AS n FROM (
    SELECT p.opened_at::date AS d, p.id
    FROM broker_orders o
    JOIN decisions e ON e.id = o.decision_id AND e.kind = 'enter'
    JOIN positions p ON p.id = o.position_id
    WHERE o.side = 'BUY' GROUP BY 1, 2 HAVING count(*) > 1
  ) x GROUP BY 1
),
-- 같은 봇이 같은 종목을 겹쳐 연 포지션 (포지션을 새로 열어 생기는 반복은 위 기준으로 안 잡혀요)
overlapped AS (
  SELECT b.opened_at::date AS d, count(*) AS n
  FROM positions a
  JOIN positions b ON a.bot_id = b.bot_id AND a.symbol = b.symbol AND a.id < b.id
    AND b.opened_at < coalesce(a.closed_at, 'infinity')
  GROUP BY 1
),
-- 봇 주문은 근거가 주문보다 먼저 저장되고 내용이 있어야 해요 (ADR-0003). 보호·수동 주문은 근거가 없어요
rationale AS (
  SELECT o.created_at::date AS d, count(*) AS n,
         count(*) FILTER (
           WHERE r.created_at <= o.created_at
             AND (r.passed::text NOT IN ('[]', '{}') OR r.failed::text NOT IN ('[]', '{}'))
         ) AS good
  FROM broker_orders o
  LEFT JOIN decisions r ON r.id = o.decision_id
  WHERE o.origin = 'bot' GROUP BY 1
)
SELECT days.d,
       days.d = (SELECT d FROM today) AND NOT coalesce(b.closed, false) AS in_progress,
       coalesce(b.ok, 0) AS batches_ok,
       coalesce(risks.n, 0) AS risk_errors,
       coalesce(repeats.n, 0) + coalesce(overlapped.n, 0) AS repeated,
       coalesce(pos.open, 0) AS left_open,
       coalesce(rationale.good, 0) AS rationale_good,
       coalesce(rationale.n, 0) AS bot_orders,
       coalesce(pos.n, 0) AS positions,
       coalesce(pos.wins, 0) AS wins,
       coalesce(pos.closed, 0) AS closed,
       coalesce(pos.pnl, 0) AS pnl,
       coalesce(pos.fees, 0) AS fees
FROM days
LEFT JOIN batches b ON b.d = days.d
LEFT JOIN risks ON risks.d = days.d
LEFT JOIN repeats ON repeats.d = days.d
LEFT JOIN overlapped ON overlapped.d = days.d
LEFT JOIN pos ON pos.d = days.d
LEFT JOIN rationale ON rationale.d = days.d;

CREATE TEMP VIEW report_verdicts AS
SELECT *,
       CASE
         WHEN in_progress THEN '진행 중'
         WHEN batches_ok < 3 OR risk_errors > 0 OR repeated > 0 OR left_open > 0
              OR rationale_good < bot_orders THEN '실패'
         ELSE '통과'
       END AS verdict
FROM report_days;

\echo '== 거래일별 M3 점검 =='
SELECT d AS "거래일", verdict AS "판정", batches_ok || '/3' AS "배치",
       risk_errors AS "봇 오류", repeated AS "주문 반복", left_open AS "미청산",
       rationale_good || '/' || bot_orders AS "근거",
       positions AS "포지션", wins || '/' || closed AS "승/청산", pnl AS "실현 손익", fees AS "수수료"
FROM report_verdicts ORDER BY d;

\echo '== 연속 통과 거래일 (기준 5일, 진행 중인 날은 세지 않아요) =='
SELECT count(*) AS "연속 통과", coalesce(sum(pnl), 0) AS "구간 손익"
FROM report_verdicts
WHERE NOT in_progress
  AND d > coalesce((SELECT max(d) FROM report_verdicts WHERE verdict = '실패'), '-infinity');

\echo '== 청산 사유 =='
SELECT coalesce(exit_reason, '(보유 중)') AS "사유", count(*) AS "건수", sum(realized_pnl) AS "실현 손익"
FROM positions GROUP BY 1 ORDER BY 2 DESC;

\echo '== 엔진 =='
SELECT state AS "상태", halt_reasons AS "정지 사유", heartbeat_at AS "마지막 신호",
       now() - heartbeat_at AS "경과"
FROM engine_statuses;
