import { MigrationInterface, QueryRunner } from 'typeorm';

// 첫 migration이 생성 컬럼(account_snapshots.available_capital) 메타데이터에 만든 DB 이름(tradelytics)을 적었어요.
// DB 이름이 다른 곳(CI의 app 등)에서는 TypeORM이 스키마가 바뀐 것으로 봐서 migration 누락 검사가 실패해요.
// 지금 DB 이름으로 맞춰요
export class FixGeneratedColumnMetadata1793580000000 implements MigrationInterface {
  name = 'FixGeneratedColumnMetadata1793580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "typeorm_metadata" SET "database" = current_database() WHERE "type" = 'GENERATED_COLUMN' AND "table" = 'account_snapshots' AND "name" = 'available_capital'`,
    );
  }

  // 되돌릴 이전 이름은 DB마다 달라서 그대로 둬요
  public async down(): Promise<void> {
    await Promise.resolve();
  }
}
