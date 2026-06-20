import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StoreType {
  CAFETERIA = 'CAFETERIA',
  PAPELERIA = 'PAPELERIA',
  RESTAURANTE = 'RESTAURANTE',
}

export enum StoreStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
}

/**
 * Réplica de solo lectura de la tienda propietaria en Identity Service.
 * Se mantiene sincronizada vía eventos `identity.store.*` (ver StoreSyncService).
 * Nunca se escribe desde products-service: Identity es la única fuente de verdad.
 */
@Entity('stores')
export class Store {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'UUID de la tienda, igual al id en Identity Service',
    format: 'uuid',
  })
  @PrimaryColumn('uuid')
  id: string;

  @ApiProperty({ example: 'a3bb189e-8bf9-3888-9912-ace4e6543002', description: 'UUID del propietario' })
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @ApiProperty({ example: 'Cafetería Central' })
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @ApiProperty({ enum: StoreType, example: StoreType.CAFETERIA })
  @Column({ type: 'enum', enum: StoreType })
  type: StoreType;

  @ApiProperty({ enum: StoreStatus, example: StoreStatus.OPEN })
  @Column({ type: 'enum', enum: StoreStatus, default: StoreStatus.OPEN })
  status: StoreStatus;

  @ApiProperty({ example: true, description: 'Espejo de Store.isActive en Identity' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: 'Bloque 5, primer piso', nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @ApiProperty({
    description: 'Marca de tiempo de la última sincronización exitosa con Identity Service',
  })
  @Column({ name: 'synced_at', type: 'timestamptz' })
  syncedAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T12:00:00.000Z' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
