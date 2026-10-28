import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchema1793194433654 implements MigrationInterface {
  name = 'CreateSchema1793194433654';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bots" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "name" text NOT NULL, "type" text NOT NULL, "risk_profile" text NOT NULL, "stage" text NOT NULL DEFAULT 'verifying', "status" text NOT NULL DEFAULT 'ready', "status_reason" text, "budget_type" text NOT NULL, "budget_ratio" numeric(5,4), "budget_amount" bigint, "start_priority" integer NOT NULL, "trading_start" TIME NOT NULL, "trading_end" TIME NOT NULL, "period_start" date NOT NULL, "period_end" date, "on_period_end" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ee9b63333bc7bab441b91449dc7" UNIQUE ("name"), CONSTRAINT "CHK_5a416eae1469bc999d66b6dd1e" CHECK ("trading_start" < "trading_end"), CONSTRAINT "CHK_8b0c81e3471f8ba9d277d44041" CHECK (("budget_type" = 'fixed') = ("budget_amount" IS NOT NULL)), CONSTRAINT "CHK_762e5317e0a19e7d6cde757220" CHECK (("budget_type" = 'ratio') = ("budget_ratio" IS NOT NULL)), CONSTRAINT "CHK_9f9fc5f62bf387d6b08f213eb9" CHECK ("budget_amount" > 0), CONSTRAINT "CHK_f028fef4bb8054fbb71dff15cb" CHECK ("budget_ratio" > 0 AND "budget_ratio" <= 1), CONSTRAINT "CHK_d63950dc3ea697f682d20298e8" CHECK ("on_period_end" IN ('liquidate', 'hold')), CONSTRAINT "CHK_7858f2542102c81e6584c8e6b8" CHECK ("budget_type" IN ('ratio', 'fixed')), CONSTRAINT "CHK_b82f4a316adac78860bc1bba01" CHECK ("status" IN ('ready', 'running', 'paused', 'waiting_funds', 'stopped')), CONSTRAINT "CHK_571162cc350feb6d549ba01336" CHECK ("stage" IN ('verifying', 'released')), CONSTRAINT "CHK_9e3cdeebbeecc9541a3ad87cd7" CHECK ("risk_profile" IN ('aggressive', 'neutral', 'conservative')), CONSTRAINT "CHK_177267c1713375d8aae74f6aa8" CHECK ("type" IN ('scalping', 'day_trading', 'swing', 'closing_bet')), CONSTRAINT "PK_8b1b0180229dec2cbfdf5e776e4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bot_versions" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "bot_id" bigint NOT NULL, "version" integer NOT NULL, "change_kind" text NOT NULL, "params" jsonb NOT NULL, "order_size_type" text NOT NULL, "order_size_value" numeric(18,4) NOT NULL, "split_count" integer NOT NULL, "max_positions" integer NOT NULL, "daily_loss_pct" numeric(5,2) NOT NULL, "total_loss_pct" numeric(5,2) NOT NULL, "stop_streak" integer NOT NULL DEFAULT '3', "on_daily_limit" text NOT NULL, "applied_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8f806af445f9f0f98f1c7857941" UNIQUE ("bot_id", "version"), CONSTRAINT "CHK_f4b92a98009e6390a38be7cf9c" CHECK ("total_loss_pct" > 0), CONSTRAINT "CHK_afd6d5904ebef4df4810ec6be6" CHECK ("daily_loss_pct" > 0), CONSTRAINT "CHK_9be85b488a880d3950366a6a41" CHECK ("max_positions" >= 1), CONSTRAINT "CHK_0a988eb9435d9c1dc78b8b8475" CHECK ("split_count" >= 1), CONSTRAINT "CHK_a09a8369ebce2c69466d0c852d" CHECK ("order_size_value" > 0), CONSTRAINT "CHK_41ebcae3352f2b70b96737bf85" CHECK ("on_daily_limit" IN ('liquidate', 'hold')), CONSTRAINT "CHK_0a22239e2733933d2ac6e82a87" CHECK ("order_size_type" IN ('ratio', 'fixed')), CONSTRAINT "CHK_6c48dd1c004391cedc1731a8c0" CHECK ("change_kind" IN ('initial', 'decision_change', 'risk_only')), CONSTRAINT "PK_9f72c72b2bd963f422bb9b9266a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'tradelytics',
        'public',
        'account_snapshots',
        'GENERATED_COLUMN',
        'available_capital',
        '"orderable_cash" - "running_bots_cash_share"',
      ],
    );
    await queryRunner.query(
      `CREATE TABLE "account_snapshots" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "taken_at" TIMESTAMP WITH TIME ZONE NOT NULL, "orderable_cash" bigint NOT NULL, "running_bots_cash_share" bigint NOT NULL, "available_capital" bigint GENERATED ALWAYS AS ("orderable_cash" - "running_bots_cash_share") STORED NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_304e05ea85c76c06db93b799889" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "commands" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "kind" text NOT NULL, "bot_id" bigint, "liquidate_all" boolean NOT NULL DEFAULT false, "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL, "handled_at" TIMESTAMP WITH TIME ZONE, "result" text, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_2dc28fc03011ff279c54934369" CHECK (("kind" = 'kill') = ("bot_id" IS NULL)), CONSTRAINT "CHK_f9295babd4e26e6dcc60f7e8c9" CHECK ("result" IN ('ok', 'failed')), CONSTRAINT "CHK_2282f2332f4d1ea1e7f07fa0a3" CHECK ("kind" IN ('pause', 'resume', 'liquidate', 'kill', 'expand_budget')), CONSTRAINT "PK_7ac292c3aa19300482b2b190d1e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_51fef3910c3d8c6134554ce8d8" ON "commands"  ("requested_at") WHERE "handled_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "positions" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "bot_id" bigint, "symbol" text NOT NULL, "status" text NOT NULL, "quantity" integer NOT NULL, "cost_basis" bigint NOT NULL DEFAULT '0', "realized_pnl" bigint NOT NULL DEFAULT '0', "total_fees" bigint NOT NULL DEFAULT '0', "high_price" bigint, "low_price" bigint, "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL, "closed_at" TIMESTAMP WITH TIME ZONE, "exit_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_b9c7afb5fe9cf411407bfbc330" CHECK ("status" = 'open' OR "quantity" = 0), CONSTRAINT "CHK_c14bc63f7c1354dfdbd2878a82" CHECK (("status" = 'closed') = ("closed_at" IS NOT NULL)), CONSTRAINT "CHK_e7442bc03803bad6129f7a1d06" CHECK ("quantity" >= 0), CONSTRAINT "CHK_360d31478ebb81cb77c959ad98" CHECK ("exit_reason" IN ('take_profit', 'stop_loss', 'time_exit', 'market_close', 'reeval', 'manual', 'kill_switch', 'not_filled')), CONSTRAINT "CHK_b6ecfb0c374d4e372afd451d80" CHECK ("status" IN ('open', 'closed')), CONSTRAINT "PK_17e4e62ccd5749b289ae3fae6f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_debed5c18c4d8cbe1dae2558fe" ON "positions"  ("symbol") WHERE "status" = 'open'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d99563959a7b0d7ecc7e2e3e5d" ON "positions"  ("bot_id", "closed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_957a18c592ee203e7598fcc1d0" ON "positions"  ("bot_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "bot_daily_results" ("bot_id" bigint NOT NULL, "trade_date" date NOT NULL, "bot_version_id" bigint NOT NULL, "realized_pnl" bigint NOT NULL, "unrealized_pnl" bigint NOT NULL, "fees" bigint NOT NULL, "closed_trades" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3b8b2ef1faff081ed004c8a77fc" PRIMARY KEY ("bot_id", "trade_date"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "manual_notes" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "position_id" bigint NOT NULL, "memo" text, "target_price" bigint, "stop_price" bigint, "horizon_minutes" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_ccf5c05c9820672dba5bfaa21c" UNIQUE ("position_id"), CONSTRAINT "PK_be0ca35d8f0be728c8b9c26efea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "decisions" ("id" uuid NOT NULL, "bot_version_id" bigint NOT NULL, "position_id" bigint, "symbol" text NOT NULL, "kind" text NOT NULL, "decided_at" TIMESTAMP WITH TIME ZONE NOT NULL, "price" bigint NOT NULL, "passed" jsonb NOT NULL, "failed" jsonb NOT NULL, "score" smallint, "direction" text, "target_price" bigint, "stop_price" bigint, "horizon_minutes" integer, "skip_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_e3d638f6edd17f5140a32b9f38" CHECK ("kind" NOT IN ('enter', 'reeval') OR ("direction" IS NOT NULL AND "target_price" IS NOT NULL AND "stop_price" IS NOT NULL)), CONSTRAINT "CHK_0b563cad2d7fbc5d7e3b3e13a8" CHECK (("kind" = 'skip') = ("skip_reason" IS NOT NULL)), CONSTRAINT "CHK_5622a19f5348b7b178ac8ebaa3" CHECK ("score" BETWEEN 0 AND 100), CONSTRAINT "CHK_f29e6205e71ef9ef7f7c7e5259" CHECK ("skip_reason" IN ('entry_condition', 'risk', 'funds', 'symbol_lock', 'market_alert', 'order_rejected', 'rate_limit')), CONSTRAINT "CHK_a289936e2e304c83fc2e678815" CHECK ("direction" IN ('up', 'down')), CONSTRAINT "CHK_59b36b5f5ac7080673a6b75e3a" CHECK ("kind" IN ('enter', 'exit', 'skip', 'reeval')), CONSTRAINT "PK_48eee6fa229cd5e43648f6a2ec3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1fa4fdf3e492ee8eb6145473c" ON "decisions"  ("symbol", "decided_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9338c394a6d9d357d1aa7d7f50" ON "decisions"  ("position_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f5ec36d6dd12583c4f72e6055d" ON "decisions"  ("bot_version_id", "decided_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "prediction_scores" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "position_id" bigint NOT NULL, "decision_id" uuid NOT NULL, "direction_hit" boolean NOT NULL, "target_reach_pct" numeric(5,2) NOT NULL, "error_pct" numeric(7,3) NOT NULL, "scored_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_b3d88766b2bb92f7a3d8cc11fc" UNIQUE ("decision_id"), CONSTRAINT "CHK_4b3f6a4d0de6e0e944075e4bb1" CHECK ("target_reach_pct" BETWEEN 0 AND 100), CONSTRAINT "PK_2cd2dff4a5bb14085cc738da7a0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "skip_followups" ("decision_id" uuid NOT NULL, "close_price" bigint NOT NULL, "max_after" bigint NOT NULL, "min_after" bigint NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7f9449dd374a7d48b860a536f06" PRIMARY KEY ("decision_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "batch_runs" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "job" text NOT NULL, "trade_date" date NOT NULL, "slot" text NOT NULL DEFAULT '', "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "finished_at" TIMESTAMP WITH TIME ZONE, "result" text, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_18b47ac1980bf6ae5e0e742500e" UNIQUE ("job", "trade_date", "slot"), CONSTRAINT "CHK_e7d87b3a9d5da0f0167764803b" CHECK ("result" IN ('ok', 'failed', 'skipped')), CONSTRAINT "CHK_93f1f4c3da722cb0e0c0f9a0b8" CHECK ("job" IN ('pre_open', 'open_snapshot', 'open_check', 'intraday_check', 'post_close', 'weekly_check')), CONSTRAINT "PK_cb9a16f02db4f3234bfaa55f73a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "engine_statuses" ("id" smallint NOT NULL, "state" text NOT NULL, "halt_reasons" text array NOT NULL DEFAULT '{}', "stale_symbols" text array NOT NULL DEFAULT '{}', "orderable_cash" bigint, "holdings_value" bigint, "account_synced_at" TIMESTAMP WITH TIME ZONE, "heartbeat_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_35a49becca8797e62cec1025a6" CHECK ("state" IN ('running', 'stopping', 'halted')), CONSTRAINT "CHK_bf689eb9047e2951c548b36c0a" CHECK ("id" = 1), CONSTRAINT "PK_78871cd710fd229ce94e680b90e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "allocations" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "bot_id" bigint NOT NULL, "snapshot_id" bigint NOT NULL, "amount" bigint NOT NULL, "capped" boolean NOT NULL, "released_at" TIMESTAMP WITH TIME ZONE, "released_amount" bigint, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_4d09cd455c3e61c18f0df45b09" CHECK (("released_at" IS NULL) = ("released_amount" IS NULL)), CONSTRAINT "CHK_1fcef5bf395ad1c15b24f56b05" CHECK ("amount" > 0), CONSTRAINT "PK_ca63099fc248466264af0fa6f1f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_55df3dad3c90556a4bb1756b1a" ON "allocations"  ("bot_id") WHERE "released_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "disclosures" ("rcept_no" text NOT NULL, "stock_code" text NOT NULL, "pblntf_ty" character(1) NOT NULL, "report_nm" text NOT NULL, "rcept_dt" date NOT NULL, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dd5e6aece6c004cbb2b9dbf4cb5" PRIMARY KEY ("rcept_no"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e536071ef635fa9978834079d1" ON "disclosures"  ("stock_code", "rcept_dt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "market_calendars" ("trade_date" date NOT NULL, "is_open" boolean NOT NULL, "regular_open_at" TIMESTAMP WITH TIME ZONE, "regular_close_at" TIMESTAMP WITH TIME ZONE, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e58ad78dfe022cfacf698a9a709" PRIMARY KEY ("trade_date"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "quote_caches" ("symbol" text NOT NULL, "price" bigint NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_aa6fd185cce4645d6efcc933ac8" PRIMARY KEY ("symbol"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "broker_orders" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "origin" text NOT NULL, "decision_id" uuid, "position_id" bigint NOT NULL, "broker_order_id" text, "symbol" text NOT NULL, "side" text NOT NULL, "order_type" text NOT NULL, "time_in_force" text NOT NULL, "price" bigint, "quantity" integer NOT NULL, "status" text NOT NULL, "reject_code" text, "filled_quantity" integer NOT NULL DEFAULT '0', "avg_filled_price" numeric(18,4), "filled_amount" bigint, "commission" bigint, "tax" bigint, "ordered_at" TIMESTAMP WITH TIME ZONE, "filled_at" TIMESTAMP WITH TIME ZONE, "canceled_at" TIMESTAMP WITH TIME ZONE, "settlement_date" date, "synced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_55efe828cbdc9eb37ec1947084c" UNIQUE ("broker_order_id"), CONSTRAINT "REL_3f36990fe6229ea78bcd699249" UNIQUE ("decision_id"), CONSTRAINT "CHK_86717fbdf08d6d7ce4c495eb79" CHECK (("status" = 'request_failed') = ("reject_code" IS NOT NULL)), CONSTRAINT "CHK_a7a0d9f9f6d19622e15b1e410d" CHECK ("status" IN ('requested', 'request_failed') OR "broker_order_id" IS NOT NULL), CONSTRAINT "CHK_310dd6d402a0f2223477a2e70f" CHECK (("origin" = 'bot') = ("decision_id" IS NOT NULL)), CONSTRAINT "CHK_16a5941de5f4ddd8890f79d7cd" CHECK ("quantity" > 0), CONSTRAINT "CHK_97331115b83b8182046fc3eea2" CHECK ("time_in_force" IN ('DAY', 'CLS', 'OPG')), CONSTRAINT "CHK_aacb8960cb9413520fbbcb4e01" CHECK ("order_type" IN ('LIMIT', 'MARKET')), CONSTRAINT "CHK_d0bd6b8cef76cbe1a5c17a6ced" CHECK ("side" IN ('BUY', 'SELL')), CONSTRAINT "CHK_ee4b1916ab70eced5046e2fa25" CHECK ("origin" IN ('bot', 'protective', 'manual')), CONSTRAINT "PK_96a0fdd629e6dee0ff1b52287e3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1915e8cdddd2cf7b634575102c" ON "broker_orders"  ("symbol") WHERE "status" IN ('requested', 'PENDING', 'PARTIAL_FILLED', 'PENDING_CANCEL', 'PENDING_REPLACE')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53b4d4b2d8dd303372e339d43e" ON "broker_orders"  ("position_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "fee_schedules" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "effective_from" date NOT NULL, "commission_rate" numeric(8,6) NOT NULL, "tax_rate" numeric(8,6) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_abe85349d754c8357389f7e0cf7" UNIQUE ("effective_from"), CONSTRAINT "PK_ae001408545ef0d0ed96d84662f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_events" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "order_id" bigint NOT NULL, "source" text NOT NULL, "status" text NOT NULL, "filled_quantity_delta" integer NOT NULL DEFAULT '0', "fill_price" bigint, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "raw" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_babb341f4d73ebb3950b3237af" CHECK ("source" IN ('ws', 'rest')), CONSTRAINT "PK_cc1b82b0fcf1be577d9d7ecbf8b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b7fd19b339abb0577743c67961" ON "order_events"  ("order_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "protective_orders" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "position_id" bigint NOT NULL, "broker_conditional_order_id" text, "client_order_id" uuid NOT NULL, "trigger_price" bigint NOT NULL, "quantity" integer NOT NULL, "expire_date" date NOT NULL, "status" text NOT NULL, "triggered_order_id" text, "closed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_3ed55f3e8129fdf9a94c567a79f" UNIQUE ("broker_conditional_order_id"), CONSTRAINT "UQ_6b903f17b5d98414a9b01a602d9" UNIQUE ("client_order_id"), CONSTRAINT "CHK_a27db8df9001fbcb581a0ef8fa" CHECK ("quantity" > 0), CONSTRAINT "CHK_688a52734fa07ae0dae948123a" CHECK ("status" IN ('requested', 'open', 'canceling', 'canceled', 'triggered', 'expired')), CONSTRAINT "PK_f4f6becf9aef042cb64e2969435" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_59feb4bc4ddda419a183e8582e" ON "protective_orders"  ("position_id") WHERE "status" IN ('requested', 'open', 'canceling')`,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_events" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "bot_id" bigint, "kind" text NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "detail" jsonb NOT NULL, "notified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_be7636a91c6b862e498cbf191b" CHECK ("kind" IN ('daily_stop', 'total_stop', 'streak_pause', 'rate_cap', 'kill_switch', 'batch_fail', 'feed_stale', 'record_fail', 'order_rejected', 'funds_waiting', 'bot_error')), CONSTRAINT "PK_f05a2fd43548e862b7b5c489f44" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48111af4b039cf1b4413252954" ON "risk_events"  ("bot_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "symbol_locks" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "symbol" text NOT NULL, "bot_id" bigint NOT NULL, "acquired_at" TIMESTAMP WITH TIME ZONE NOT NULL, "released_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f50097cf31ecf907c501ec1d61e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3ef81a3dc06561a3e89a4fba5f" ON "symbol_locks"  ("symbol") WHERE "released_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot_versions" ADD CONSTRAINT "FK_45053d91cef5af63a520777243e" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commands" ADD CONSTRAINT "FK_776b03eed84dd4b31b33fcc1876" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "FK_223d74d7aeabb3d556e0abe3353" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot_daily_results" ADD CONSTRAINT "FK_7ed96259d7e215dfd939b87feb8" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot_daily_results" ADD CONSTRAINT "FK_d73ff13990002fc48dcac974d92" FOREIGN KEY ("bot_version_id") REFERENCES "bot_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "manual_notes" ADD CONSTRAINT "FK_ccf5c05c9820672dba5bfaa21cc" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisions" ADD CONSTRAINT "FK_97072f3f8487186ebf4c73051a8" FOREIGN KEY ("bot_version_id") REFERENCES "bot_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisions" ADD CONSTRAINT "FK_9338c394a6d9d357d1aa7d7f509" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prediction_scores" ADD CONSTRAINT "FK_beed2a8ffa0b5c79bd1acc1a401" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prediction_scores" ADD CONSTRAINT "FK_b3d88766b2bb92f7a3d8cc11fcc" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "skip_followups" ADD CONSTRAINT "FK_7f9449dd374a7d48b860a536f06" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "allocations" ADD CONSTRAINT "FK_f494638329b7862581fdde8d142" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "allocations" ADD CONSTRAINT "FK_b916392d4e06df3a1b3e2e35367" FOREIGN KEY ("snapshot_id") REFERENCES "account_snapshots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "broker_orders" ADD CONSTRAINT "FK_3f36990fe6229ea78bcd6992493" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "broker_orders" ADD CONSTRAINT "FK_53b4d4b2d8dd303372e339d43e9" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_events" ADD CONSTRAINT "FK_b33cbf9a59cbee112d94bcb59de" FOREIGN KEY ("order_id") REFERENCES "broker_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "protective_orders" ADD CONSTRAINT "FK_94d5d58dc0e209eedf25b089f5b" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_events" ADD CONSTRAINT "FK_c4d51ee8565dc3e189d3eb7ff88" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "symbol_locks" ADD CONSTRAINT "FK_cf002823a7773bee540cc2a45bc" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "symbol_locks" DROP CONSTRAINT "FK_cf002823a7773bee540cc2a45bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_events" DROP CONSTRAINT "FK_c4d51ee8565dc3e189d3eb7ff88"`,
    );
    await queryRunner.query(
      `ALTER TABLE "protective_orders" DROP CONSTRAINT "FK_94d5d58dc0e209eedf25b089f5b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_events" DROP CONSTRAINT "FK_b33cbf9a59cbee112d94bcb59de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broker_orders" DROP CONSTRAINT "FK_53b4d4b2d8dd303372e339d43e9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broker_orders" DROP CONSTRAINT "FK_3f36990fe6229ea78bcd6992493"`,
    );
    await queryRunner.query(
      `ALTER TABLE "allocations" DROP CONSTRAINT "FK_b916392d4e06df3a1b3e2e35367"`,
    );
    await queryRunner.query(
      `ALTER TABLE "allocations" DROP CONSTRAINT "FK_f494638329b7862581fdde8d142"`,
    );
    await queryRunner.query(
      `ALTER TABLE "skip_followups" DROP CONSTRAINT "FK_7f9449dd374a7d48b860a536f06"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prediction_scores" DROP CONSTRAINT "FK_b3d88766b2bb92f7a3d8cc11fcc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prediction_scores" DROP CONSTRAINT "FK_beed2a8ffa0b5c79bd1acc1a401"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisions" DROP CONSTRAINT "FK_9338c394a6d9d357d1aa7d7f509"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisions" DROP CONSTRAINT "FK_97072f3f8487186ebf4c73051a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "manual_notes" DROP CONSTRAINT "FK_ccf5c05c9820672dba5bfaa21cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot_daily_results" DROP CONSTRAINT "FK_d73ff13990002fc48dcac974d92"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot_daily_results" DROP CONSTRAINT "FK_7ed96259d7e215dfd939b87feb8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT "FK_223d74d7aeabb3d556e0abe3353"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commands" DROP CONSTRAINT "FK_776b03eed84dd4b31b33fcc1876"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot_versions" DROP CONSTRAINT "FK_45053d91cef5af63a520777243e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ef81a3dc06561a3e89a4fba5f"`,
    );
    await queryRunner.query(`DROP TABLE "symbol_locks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_48111af4b039cf1b4413252954"`,
    );
    await queryRunner.query(`DROP TABLE "risk_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_59feb4bc4ddda419a183e8582e"`,
    );
    await queryRunner.query(`DROP TABLE "protective_orders"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b7fd19b339abb0577743c67961"`,
    );
    await queryRunner.query(`DROP TABLE "order_events"`);
    await queryRunner.query(`DROP TABLE "fee_schedules"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_53b4d4b2d8dd303372e339d43e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1915e8cdddd2cf7b634575102c"`,
    );
    await queryRunner.query(`DROP TABLE "broker_orders"`);
    await queryRunner.query(`DROP TABLE "quote_caches"`);
    await queryRunner.query(`DROP TABLE "market_calendars"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e536071ef635fa9978834079d1"`,
    );
    await queryRunner.query(`DROP TABLE "disclosures"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_55df3dad3c90556a4bb1756b1a"`,
    );
    await queryRunner.query(`DROP TABLE "allocations"`);
    await queryRunner.query(`DROP TABLE "engine_statuses"`);
    await queryRunner.query(`DROP TABLE "batch_runs"`);
    await queryRunner.query(`DROP TABLE "skip_followups"`);
    await queryRunner.query(`DROP TABLE "prediction_scores"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f5ec36d6dd12583c4f72e6055d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9338c394a6d9d357d1aa7d7f50"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f1fa4fdf3e492ee8eb6145473c"`,
    );
    await queryRunner.query(`DROP TABLE "decisions"`);
    await queryRunner.query(`DROP TABLE "manual_notes"`);
    await queryRunner.query(`DROP TABLE "bot_daily_results"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_957a18c592ee203e7598fcc1d0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d99563959a7b0d7ecc7e2e3e5d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_debed5c18c4d8cbe1dae2558fe"`,
    );
    await queryRunner.query(`DROP TABLE "positions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_51fef3910c3d8c6134554ce8d8"`,
    );
    await queryRunner.query(`DROP TABLE "commands"`);
    await queryRunner.query(`DROP TABLE "account_snapshots"`);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      [
        'GENERATED_COLUMN',
        'available_capital',
        'tradelytics',
        'public',
        'account_snapshots',
      ],
    );
    await queryRunner.query(`DROP TABLE "bot_versions"`);
    await queryRunner.query(`DROP TABLE "bots"`);
  }
}
