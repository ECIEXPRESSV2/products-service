import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductMediaAndModelColumns1791000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "front_image_url" varchar(500),
        ADD COLUMN IF NOT EXISTS "left_image_url" varchar(500),
        ADD COLUMN IF NOT EXISTS "back_image_url" varchar(500),
        ADD COLUMN IF NOT EXISTS "model_3d_url" varchar(500),
        ADD COLUMN IF NOT EXISTS "model_generation_status" varchar(20) NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "model_generation_progress" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "model_generation_error" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "model_generation_error",
        DROP COLUMN IF EXISTS "model_generation_progress",
        DROP COLUMN IF EXISTS "model_generation_status",
        DROP COLUMN IF EXISTS "model_3d_url",
        DROP COLUMN IF EXISTS "back_image_url",
        DROP COLUMN IF EXISTS "left_image_url",
        DROP COLUMN IF EXISTS "front_image_url"
    `);
  }
}
