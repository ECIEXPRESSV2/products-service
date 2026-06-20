import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1749772800000 implements MigrationInterface {
  name = 'CreateAuditLogsTable1749772800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
        "entity_name"  VARCHAR(100)  NOT NULL,
        "entity_id"    UUID,
        "action"       VARCHAR(20)   NOT NULL,
        "before_data"  JSONB,
        "after_data"   JSONB,
        "metadata"     JSONB,
        "ip_address"   VARCHAR(45),
        "performed_by" VARCHAR(255)  NOT NULL DEFAULT 'system',
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_entity"
        ON "audit_logs" ("entity_name", "entity_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_created_at"
        ON "audit_logs" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_entity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
