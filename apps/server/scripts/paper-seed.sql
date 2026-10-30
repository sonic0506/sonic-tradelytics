-- 개발 점검(PaperBroker, 로드맵 M3)용 시드. 이름이 _paper로 끝나는 DB에서만 돌아요.
-- 여러 번 실행해도 같은 행을 다시 넣지 않아요.
--   docker exec -i sonic-tradelytics-db psql -U postgres -d tradelytics_paper -v ON_ERROR_STOP=1 < scripts/paper-seed.sql

DO $$
BEGIN
  IF current_database() NOT LIKE '%\_paper' THEN
    RAISE EXCEPTION 'paper 시드는 _paper DB에서만 넣어요 (지금: %)', current_database();
  END IF;
END $$;

BEGIN;

-- 수수료: 토스 GET /api/v1/commissions(KR, 2021-01-01~). 세금: 2026 증권거래세 0.20%
-- (코스피는 거래세 0.05% + 농특세 0.15%. 2026-10-30 실제 매도 체결의 tax로 확인)
INSERT INTO fee_schedules (effective_from, commission_rate, tax_rate)
VALUES ('2026-01-01', 0.00015, 0.002)
ON CONFLICT (effective_from) DO NOTHING;

-- 데이 트레이딩 봇 1개 (중립, 검증 구간). 투자금은 검증 구간 상한 10만 원 (POL-RISK-09)
INSERT INTO bots (
  name, type, risk_profile, stage, status, budget_type, budget_amount,
  start_priority, trading_start, trading_end, period_start, on_period_end
)
VALUES (
  'paper-day-trading', 'day', 'neutral', 'verifying', 'running', 'fixed', 100000,
  1, '09:05', '15:20', CURRENT_DATE, 'liquidate'
)
ON CONFLICT (name) DO NOTHING;

-- 버전 1: params를 비워 두면 데이 트레이딩 기본값(F1)을 써요
INSERT INTO bot_versions (
  bot_id, version, change_kind, params, order_size_type, order_size_value,
  split_count, max_positions, daily_loss_pct, total_loss_pct, stop_streak,
  on_daily_limit, applied_at
)
SELECT id, 1, 'initial', '{}'::jsonb, 'fixed', 50000,
  1, 2, 4, 10, 3,
  'liquidate', now()
FROM bots
WHERE name = 'paper-day-trading'
ON CONFLICT (bot_id, version) DO NOTHING;

COMMIT;
