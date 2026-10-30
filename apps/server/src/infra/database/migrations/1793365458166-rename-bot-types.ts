import { MigrationInterface, QueryRunner } from 'typeorm';

// 봇 유형 코드를 용어집(docs/project/glossary.md)에 맞춰요: day_trading → day, closing_bet → closing
export class RenameBotTypes1793365458166 implements MigrationInterface {
  name = 'RenameBotTypes1793365458166';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bots" DROP CONSTRAINT "CHK_177267c1713375d8aae74f6aa8"`,
    );
    // 이미 저장된 봇의 유형도 같이 바꿔요
    await queryRunner.query(
      `UPDATE "bots" SET "type" = CASE "type" WHEN 'day_trading' THEN 'day' WHEN 'closing_bet' THEN 'closing' ELSE "type" END`,
    );
    await queryRunner.query(
      `ALTER TABLE "bots" ADD CONSTRAINT "CHK_11ba0a2fd88e538f6933e968bb" CHECK ("type" IN ('scalping', 'day', 'swing', 'closing'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bots" DROP CONSTRAINT "CHK_11ba0a2fd88e538f6933e968bb"`,
    );
    await queryRunner.query(
      `UPDATE "bots" SET "type" = CASE "type" WHEN 'day' THEN 'day_trading' WHEN 'closing' THEN 'closing_bet' ELSE "type" END`,
    );
    await queryRunner.query(
      `ALTER TABLE "bots" ADD CONSTRAINT "CHK_177267c1713375d8aae74f6aa8" CHECK ((type = ANY (ARRAY['scalping'::text, 'day_trading'::text, 'swing'::text, 'closing_bet'::text])))`,
    );
  }
}
