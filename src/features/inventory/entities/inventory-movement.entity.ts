import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MovementType {
  PURCHASE = 'PURCHASE',        // Entrada por compra / reabastecimiento manual
  ADJUSTMENT = 'ADJUSTMENT',    // Ajuste manual de inventario
  RESERVATION = 'RESERVATION',  // Reserva de stock al crear un pedido
  RELEASE = 'RELEASE',          // Liberación de reserva por cancelación de pedido
  SALE = 'SALE',                // Salida de stock al confirmar un pedido
  RETURN = 'RETURN',            // Devolución de producto al inventario
}

@Entity('inventory_movements')
@Index('IDX_inv_mov_product_created', ['productId', 'createdAt'])
@Index('IDX_inv_mov_store_created', ['storeId', 'createdAt'])
export class InventoryMovement {
  @ApiProperty({ example: 'd4ec388e-9bf9-4888-aa12-ace4e6543999', format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'b2cc188e-9bf9-4888-aa12-ace4e6543111', format: 'uuid' })
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', format: 'uuid' })
  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @ApiProperty({ enum: MovementType, example: MovementType.PURCHASE })
  @Column({ type: 'enum', enum: MovementType })
  type: MovementType;

  @ApiProperty({ example: 10, description: 'Cantidad involucrada (siempre positiva)', minimum: 0 })
  @Column({ type: 'int' })
  quantity: number;

  @ApiProperty({ example: 40, description: 'Stock físico total antes del movimiento' })
  @Column({ name: 'stock_before', type: 'int' })
  stockBefore: number;

  @ApiProperty({ example: 50, description: 'Stock físico total después del movimiento' })
  @Column({ name: 'stock_after', type: 'int' })
  stockAfter: number;

  @ApiProperty({ example: 5, description: 'Stock reservado antes del movimiento' })
  @Column({ name: 'reserved_stock_before', type: 'int' })
  reservedStockBefore: number;

  @ApiProperty({ example: 5, description: 'Stock reservado después del movimiento' })
  @Column({ name: 'reserved_stock_after', type: 'int' })
  reservedStockAfter: number;

  @ApiPropertyOptional({
    example: 'order-uuid-123',
    description: 'ID externo de referencia (pedido, ajuste, etc.)',
    nullable: true,
  })
  @Column({ name: 'reference_id', type: 'varchar', length: 255, nullable: true })
  referenceId: string | null;

  @ApiPropertyOptional({ example: 'Reabastecimiento semanal', nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
