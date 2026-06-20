import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateStoresTable1750291200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "stores_type_enum" AS ENUM ('CAFETERIA', 'PAPELERIA', 'RESTAURANTE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "stores_status_enum" AS ENUM ('OPEN', 'CLOSED', 'TEMPORARILY_CLOSED')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'stores',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'owner_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'stores_type_enum',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'stores_status_enum',
            default: `'OPEN'`,
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'location',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'synced_at',
            type: 'timestamptz',
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

    // Optimiza la validación de pertenencia/estado activo en cada creación de producto/categoría
    await queryRunner.createIndex(
      'stores',
      new TableIndex({
        name: 'IDX_stores_is_active',
        columnNames: ['is_active'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('stores', 'IDX_stores_is_active');
    await queryRunner.dropTable('stores');
    await queryRunner.query(`DROP TYPE "stores_status_enum"`);
    await queryRunner.query(`DROP TYPE "stores_type_enum"`);
  }
}
