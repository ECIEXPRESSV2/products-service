import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PromotionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum PromotionScope {
  PRODUCT = 'PRODUCT',
  CATEGORY = 'CATEGORY',
}

@Entity('promotions')
@Index('IDX_promotions_store_active', ['storeId', 'isActive'])
@Index('IDX_promotions_target', ['targetId', 'scope'])
export class Promotion {
  @ApiProperty({ example: 'c3dc299f-8bf9-4888-aa12-ace4e6543777', format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'UUID de la tienda dueña de la promoción',
    format: 'uuid',
  })
  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @ApiProperty({ example: '2x1 en Cafés', maxLength: 255 })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiPropertyOptional({ example: 'Promo válida solo en horario de la mañana', nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ enum: PromotionType, example: PromotionType.PERCENTAGE })
  @Column({ type: 'enum', enum: PromotionType })
  type: PromotionType;

  @ApiProperty({
    example: '15.00',
    description: 'Porcentaje (0–100) para PERCENTAGE, o monto fijo a descontar para FIXED_AMOUNT',
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: string;

  @ApiProperty({ enum: PromotionScope, example: PromotionScope.PRODUCT })
  @Column({ type: 'enum', enum: PromotionScope })
  scope: PromotionScope;

  @ApiProperty({
    example: 'b2cc188e-9bf9-4888-aa12-ace4e6543111',
    description: 'UUID del producto o categoría al que aplica la promoción',
    format: 'uuid',
  })
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @ApiProperty({ example: '2024-06-01T00:00:00.000Z', description: 'Inicio de vigencia (UTC)' })
  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @ApiPropertyOptional({
    example: '2024-12-31T23:59:59.000Z',
    description: 'Fin de vigencia (UTC). Null = sin vencimiento.',
    nullable: true,
  })
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @ApiProperty({ example: true })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T12:00:00.000Z' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
