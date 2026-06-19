import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePromotionsTable1750118400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'promotions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
            isNullable: false,
          },
          {
            name: 'value',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'scope',
            type: 'enum',
            enum: ['PRODUCT', 'CATEGORY'],
            isNullable: false,
          },
          {
            name: 'target_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'starts_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'ends_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'promotions',
      new TableIndex({
        name: 'IDX_promotions_store_active',
        columnNames: ['store_id', 'is_active'],
      }),
    );

    await queryRunner.createIndex(
      'promotions',
      new TableIndex({
        name: 'IDX_promotions_target',
        columnNames: ['target_id', 'scope'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('promotions', 'IDX_promotions_target');
    await queryRunner.dropIndex('promotions', 'IDX_promotions_store_active');
    await queryRunner.dropTable('promotions');
  }
}
