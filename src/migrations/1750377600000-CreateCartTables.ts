import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCartTables1750377600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'carts',
        columns: [
          // id NO se genera: es el cartId (= orderId) que envía orders-service.
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'store_id', type: 'uuid', isNullable: false },
          { name: 'currency', type: 'varchar', length: '8', default: "'COP'", isNullable: false },
          { name: 'subtotal_amount', type: 'bigint', default: 0, isNullable: false },
          { name: 'discount_amount', type: 'bigint', default: 0, isNullable: false },
          { name: 'final_amount', type: 'bigint', default: 0, isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'carts',
      new TableIndex({ name: 'IDX_carts_store', columnNames: ['store_id'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'cart_lines',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
          { name: 'cart_id', type: 'uuid', isNullable: false },
          { name: 'product_id', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'image_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'list_unit_price', type: 'bigint', isNullable: false },
          { name: 'unit_price', type: 'bigint', isNullable: false },
          { name: 'quantity', type: 'int', isNullable: false },
          { name: 'total_amount', type: 'bigint', isNullable: false },
          { name: 'applied_promotion_id', type: 'uuid', isNullable: true },
        ],
        foreignKeys: [
          {
            columnNames: ['cart_id'],
            referencedTableName: 'carts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'cart_lines',
      new TableIndex({ name: 'IDX_cart_lines_cart', columnNames: ['cart_id'] }),
    );
    await queryRunner.createIndex(
      'cart_lines',
      new TableIndex({
        name: 'IDX_cart_lines_cart_product',
        columnNames: ['cart_id', 'product_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('cart_lines', true);
    await queryRunner.dropTable('carts', true);
  }
}
