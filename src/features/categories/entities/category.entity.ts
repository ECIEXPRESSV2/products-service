import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('categories')
export class Category {
  @ApiProperty({
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    description: 'Identificador único de la categoría',
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'UUID de la tienda propietaria (referencia lógica al Identity Service)',
    format: 'uuid',
  })
  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @ApiPropertyOptional({
    description: 'UUID de la categoría padre',
    example: null,
    format: 'uuid',
    nullable: true,
  })
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ApiPropertyOptional({ type: () => Category, description: 'Categoría padre' })
  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null;

  @ApiPropertyOptional({ type: () => [Category], description: 'Subcategorías directas' })
  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @ApiProperty({ example: 'Bebidas', description: 'Nombre de la categoría', maxLength: 100 })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({
    example: 'bebidas',
    description: 'Slug único por tienda',
    maxLength: 100,
  })
  @Column({ type: 'varchar', length: 100, unique: false })
  slug: string;

  @ApiPropertyOptional({
    example: 'Refrescos, jugos, aguas y bebidas energéticas',
    description: 'Descripción opcional',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: true, description: 'Indica si la categoría está activa' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ example: 1, description: 'Orden de visualización (menor = primero)', minimum: 0 })
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Fecha de creación (UTC)' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T12:00:00.000Z', description: 'Última actualización (UTC)' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
