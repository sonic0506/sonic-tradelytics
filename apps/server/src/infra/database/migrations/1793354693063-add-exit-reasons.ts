import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExitReasons1793354693063 implements MigrationInterface {
  name = 'AddExitReasons1793354693063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT "CHK_360d31478ebb81cb77c959ad98"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "CHK_0b91d54cc535f89f077d5f0239" CHECK ("exit_reason" IN ('take_profit', 'stop_loss', 'time_exit', 'market_close', 'rule_exit', 'loss_limit', 'reeval', 'manual', 'kill_switch', 'not_filled'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT "CHK_0b91d54cc535f89f077d5f0239"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "CHK_360d31478ebb81cb77c959ad98" CHECK ((exit_reason = ANY (ARRAY['take_profit'::text, 'stop_loss'::text, 'time_exit'::text, 'market_close'::text, 'reeval'::text, 'manual'::text, 'kill_switch'::text, 'not_filled'::text])))`,
    );
  }
}
