-- 검증 구간 봇의 상한 초과 주문을 거래일별로 세요 (POL-RISK-09, 로드맵 M5 "상한 초과 주문 0건"). 읽기만 해서 운영·paper DB 어디서나 돌아요.
--   docker exec -i sonic-tradelytics-db psql -U postgres -d tradelytics_paper -v ON_ERROR_STOP=1 < scripts/over-cap-report.sql
-- 봇 매수 주문을 낸 순간, 그 주문 금액과 같은 봇이 이미 들고 있던 포지션(일부 매도 뒤 남은 수량)의 매수 금액을 더해 상한과 비교해요.
-- ponytail: 봇 단계는 지금 값(bots.stage)으로 봐요. 상한을 푼 뒤에는 그 봇의 예전 주문이 빠져요. 해제 시각을 기록하면 그 시각으로 나눠요

SET timezone = 'Asia/Seoul';
\pset footer off

CREATE TEMP VIEW over_cap_orders AS
WITH
-- src/modules/fund/fund.constants.ts의 VERIFICATION_CAP과 같은 값이에요
cap AS (SELECT 100000 AS won),
buys AS (
  SELECT o.id, o.created_at, o.position_id, p.bot_id,
         coalesce(o.filled_amount, o.price * o.quantity) AS amount,
         CASE WHEN o.filled_quantity > 0 THEN o.filled_quantity ELSE o.quantity END AS quantity
  FROM broker_orders o
  JOIN positions p ON p.id = o.position_id
  JOIN bots b ON b.id = p.bot_id AND b.stage = 'verifying'
  WHERE o.origin = 'bot' AND o.side = 'BUY' AND o.status <> 'request_failed'
)
SELECT b.id AS order_id, b.bot_id, b.created_at, b.amount,
       b.amount + coalesce((
         SELECT sum(x.amount * (1 - coalesce((
                  SELECT sum(s.filled_quantity) FROM broker_orders s
                  WHERE s.position_id = x.position_id AND s.side = 'SELL' AND s.filled_at < b.created_at
                ), 0)::numeric / x.quantity))
         FROM buys x
         JOIN positions xp ON xp.id = x.position_id
         WHERE x.bot_id = b.bot_id AND x.position_id <> b.position_id
           AND x.created_at < b.created_at
           AND coalesce(xp.closed_at, 'infinity') > b.created_at
       ), 0)::bigint AS exposure,
       (SELECT won FROM cap) AS cap
FROM buys b;

\echo '== 거래일별 상한 초과 주문 (검증 구간 봇, 기준 0건) =='
SELECT created_at::date AS "거래일", count(*) AS "봇 매수 주문",
       max(exposure) AS "최대 노출액", count(*) FILTER (WHERE exposure > cap) AS "상한 초과"
FROM over_cap_orders GROUP BY 1 ORDER BY 1;

\echo '== 상한 초과 주문 =='
SELECT order_id AS "주문", bot_id AS "봇", created_at AS "시각", amount AS "주문 금액", exposure AS "노출액"
FROM over_cap_orders WHERE exposure > cap ORDER BY created_at;
