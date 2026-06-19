import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Category } from '../../categories/entities/category.entity';

@Entity('products')
@Index('IDX_products_store_active', ['storeId', 'isActive'])
@Index('IDX_products_category', ['categoryId'])
export class Product {
  @ApiProperty({
    example: 'b2cc188e-9bf9-4888-aa12-ace4e6543111',
    description: 'Identificador único del producto',
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

  @ApiProperty({
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    description: 'UUID de la categoría a la que pertenece el producto',
    format: 'uuid',
  })
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ApiPropertyOptional({ type: () => Category, description: 'Categoría del producto' })
  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ApiProperty({ example: 'Café Americano', description: 'Nombre del producto', maxLength: 255 })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({
    example: 'cafe-americano',
    description: 'Slug URL-friendly único dentro de la tienda',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  slug: string;

  @ApiPropertyOptional({
    example: 'Café negro preparado con agua caliente, sin leche',
    description: 'Descripción del producto',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({
    example: '3500.00',
    description: 'Precio unitario del producto',
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @ApiPropertyOptional({
    example: 'CAF-001',
    description: 'Código de referencia interno (único por tienda)',
    maxLength: 100,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/products/cafe.jpg',
    description: 'URL de la imagen principal del producto',
    maxLength: 500,
    nullable: true,
  })
  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: 50, description: 'Unidades disponibles en inventario', minimum: 0 })
  @Column({ type: 'int', default: 0 })
  stock: number;

  @ApiProperty({ example: 5, description: 'Stock mínimo; por debajo de este valor el producto aparece en alertas de inventario bajo', minimum: 0 })
  @Column({ name: 'min_stock', type: 'int', default: 0 })
  minStock: number;

  @ApiProperty({ example: true, description: 'Indica si el producto está activo y visible' })
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
