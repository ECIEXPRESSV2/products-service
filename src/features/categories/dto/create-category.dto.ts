import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'UUID de la tienda a la que pertenece la categoría',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @ApiPropertyOptional({
    description: 'UUID de la categoría padre. Omitir para categorías raíz.',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiProperty({
    description: 'Nombre visible de la categoría',
    example: 'Bebidas',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Slug URL-friendly único dentro de la misma tienda',
    example: 'bebidas',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({
    description: 'Descripción opcional de la categoría',
    example: 'Refrescos, jugos, aguas y bebidas energéticas',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Orden de aparición en listados (menor = primero)',
    example: 1,
    default: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Estado inicial de la categoría',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
