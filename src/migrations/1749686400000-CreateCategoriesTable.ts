import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCategoriesTable1749686400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'categories',
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
            name: 'parent_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'sort_order',
            type: 'int',
            default: 0,
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
        foreignKeys: [
          {
            columnNames: ['parent_id'],
            referencedTableName: 'categories',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    // Unicidad de slug por tienda
    await queryRunner.createIndex(
      'categories',
      new TableIndex({
        name: 'UQ_categories_store_slug',
        columnNames: ['store_id', 'slug'],
        isUnique: true,
      }),
    );

    // Optimiza las consultas de listado activo por tienda
    await queryRunner.createIndex(
      'categories',
      new TableIndex({
        name: 'IDX_categories_store_active',
        columnNames: ['store_id', 'is_active'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('categories', 'UQ_categories_store_slug');
    await queryRunner.dropIndex('categories', 'IDX_categories_store_active');
    await queryRunner.dropTable('categories');
  }
}
