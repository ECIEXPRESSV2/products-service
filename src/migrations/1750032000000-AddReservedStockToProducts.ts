import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddReservedStockToProducts1750032000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'reserved_stock',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('products', 'reserved_stock');
  }
}
