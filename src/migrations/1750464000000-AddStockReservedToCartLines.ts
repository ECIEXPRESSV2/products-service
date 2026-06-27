import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStockReservedToCartLines1750464000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'cart_lines',
      new TableColumn({ name: 'stock_reserved', type: 'boolean', default: false, isNullable: false }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('cart_lines', 'stock_reserved');
  }
}
