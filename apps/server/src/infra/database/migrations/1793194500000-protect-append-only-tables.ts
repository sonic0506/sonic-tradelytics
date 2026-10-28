import type { MigrationInterface, QueryRunner } from 'typeorm';

// 추가만 하는 표(NFR-04)의 UPDATE·DELETE를 DB가 거부해요.
// 운영도 표 소유자 계정 하나로 접속해서 권한 회수(REVOKE)로는 못 막아요(소유자는 권한을 다시 줄 수 있어요). 그래서 트리거로 막아요.
// TRUNCATE(e2e의 resetDatabase)는 행 트리거가 걸리지 않아요.
const APPEND_ONLY_TABLES = [
  'decisions',
  'order_events',
  'prediction_scores',
  'account_snapshots',
];

export class ProtectAppendOnlyTables1793194500000 implements MigrationInterface {
  name = 'ProtectAppendOnlyTables1793194500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 23001 restrict_violation: 코드에서 이 오류를 구분할 수 있어요
    await queryRunner.query(`
      CREATE FUNCTION reject_append_only_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION '% 표는 추가만 해요 (%)', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
      END $$`);
    for (const table of APPEND_ONLY_TABLES) {
      await queryRunner.query(
        `CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION reject_append_only_change()`,
      );
    }

    // risk_events는 알림을 보낸 뒤 notified_at을 null에서 한 번 채우는 것만 허용해요
    await queryRunner.query(`
      CREATE FUNCTION reject_risk_event_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'UPDATE'
          AND OLD.notified_at IS NULL AND NEW.notified_at IS NOT NULL
          AND to_jsonb(NEW) - 'notified_at' = to_jsonb(OLD) - 'notified_at' THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'risk_events 표는 추가와 notified_at 기록만 해요 (%)', TG_OP USING ERRCODE = 'restrict_violation';
      END $$`);
    await queryRunner.query(
      `CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON "risk_events" FOR EACH ROW EXECUTE FUNCTION reject_risk_event_change()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER append_only ON "risk_events"`);
    await queryRunner.query(`DROP FUNCTION reject_risk_event_change()`);
    for (const table of APPEND_ONLY_TABLES) {
      await queryRunner.query(`DROP TRIGGER append_only ON "${table}"`);
    }
    await queryRunner.query(`DROP FUNCTION reject_append_only_change()`);
  }
}
