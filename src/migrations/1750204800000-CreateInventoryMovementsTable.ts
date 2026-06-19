import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateInventoryMovementsTable1750204800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inventory_movements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'product_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['PURCHASE', 'ADJUSTMENT', 'RESERVATION', 'RELEASE', 'SALE', 'RETURN'],
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'stock_before',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'stock_after',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'reserved_stock_before',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'reserved_stock_after',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'reference_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'inventory_movements',
      new TableIndex({
        name: 'IDX_inv_mov_product_created',
        columnNames: ['product_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'inventory_movements',
      new TableIndex({
        name: 'IDX_inv_mov_store_created',
        columnNames: ['store_id', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('inventory_movements', 'IDX_inv_mov_store_created');
    await queryRunner.dropIndex('inventory_movements', 'IDX_inv_mov_product_created');
    await queryRunner.dropTable('inventory_movements');
  }
}
