import { MigrationInterface, QueryRunner } from 'typeorm';

export class RebudgetCommand1793260633110 implements MigrationInterface {
  name = 'RebudgetCommand1793260633110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "commands" DROP CONSTRAINT "CHK_2282f2332f4d1ea1e7f07fa0a3"`,
    );
    await queryRunner.query(`ALTER TABLE "commands" ADD "budget" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "commands" ADD CONSTRAINT "CHK_6f950a3a483bc62cb130a2a51e" CHECK ("kind" IN ('pause', 'resume', 'liquidate', 'kill', 'rebudget'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "commands" DROP CONSTRAINT "CHK_6f950a3a483bc62cb130a2a51e"`,
    );
    await queryRunner.query(`ALTER TABLE "commands" DROP COLUMN "budget"`);
    await queryRunner.query(
      `ALTER TABLE "commands" ADD CONSTRAINT "CHK_2282f2332f4d1ea1e7f07fa0a3" CHECK ((kind = ANY (ARRAY['pause'::text, 'resume'::text, 'liquidate'::text, 'kill'::text, 'expand_budget'::text])))`,
    );
  }
}
