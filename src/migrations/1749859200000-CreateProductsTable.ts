import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateProductsTable1749859200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'products',
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
            name: 'category_id',
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
            name: 'slug',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'sku',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'image_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'front_image_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'left_image_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'back_image_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'model_3d_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'model_generation_status',
            type: 'varchar',
            length: '20',
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'model_generation_progress',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'model_generation_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'stock',
            type: 'int',
            default: 0,
            isNullable: false,
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
      }),
      true,
    );

    // FK a categories — RESTRICT para no poder borrar una categoría con productos activos
    await queryRunner.createForeignKey(
      'products',
      new TableForeignKey({
        name: 'FK_products_category',
        columnNames: ['category_id'],
        referencedTableName: 'categories',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Unicidad de slug por tienda
    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'UQ_products_store_slug',
        columnNames: ['store_id', 'slug'],
        isUnique: true,
      }),
    );

    // Unicidad de SKU por tienda (solo aplica a filas no nulas)
    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'UQ_products_store_sku',
        columnNames: ['store_id', 'sku'],
        isUnique: true,
      }),
    );

    // Optimiza listado activo por tienda
    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'IDX_products_store_active',
        columnNames: ['store_id', 'is_active'],
      }),
    );

    // Optimiza filtrado por categoría
    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'IDX_products_category',
        columnNames: ['category_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('products', 'IDX_products_category');
    await queryRunner.dropIndex('products', 'IDX_products_store_active');
    await queryRunner.dropIndex('products', 'UQ_products_store_sku');
    await queryRunner.dropIndex('products', 'UQ_products_store_slug');
    await queryRunner.dropForeignKey('products', 'FK_products_category');
    await queryRunner.dropTable('products');
  }
}
