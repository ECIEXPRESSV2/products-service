import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({
    description: 'UUID de la tienda a la que pertenece el producto',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @ApiProperty({
    description: 'UUID de la categoría de la tienda a la que pertenece el producto',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    description: 'Nombre visible del producto',
    example: 'Café Americano',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Slug URL-friendly único dentro de la misma tienda',
    example: 'cafe-americano',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  slug: string;

  @ApiPropertyOptional({
    description: 'Descripción detallada del producto',
    example: 'Café negro preparado con agua caliente, sin leche',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Precio unitario del producto',
    example: 3500,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({
    description: 'Código de referencia interno (único por tienda)',
    example: 'CAF-001',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({
    description: 'URL de la imagen principal del producto',
    example: 'https://cdn.example.com/products/cafe.jpg',
    maxLength: 500,
  })
  @IsUrl()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Stock inicial disponible',
    example: 50,
    default: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  stock?: number;

  @ApiPropertyOptional({
    description: 'Stock mínimo; el producto aparece en alertas de inventario bajo cuando stock <= minStock',
    example: 5,
    default: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minStock?: number;

  @ApiPropertyOptional({
    description: 'Estado inicial del producto',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Orden de aparición en listados (menor = primero)',
    example: 1,
    default: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}
