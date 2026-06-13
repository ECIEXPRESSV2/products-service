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
  @ApiProperty({ description: 'ID de la tienda a la que pertenece la categoría' })
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @ApiPropertyOptional({ description: 'ID de la categoría padre (para subcategorías)' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiProperty({ description: 'Nombre de la categoría', example: 'Bebidas' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Slug único por tienda', example: 'bebidas' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ description: 'Descripción opcional de la categoría' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Orden de visualización', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Estado activo/inactivo', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
