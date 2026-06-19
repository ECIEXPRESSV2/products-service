import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { MovementType } from '../entities/inventory-movement.entity';

export class QueryMovementsDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por tienda' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por producto' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ enum: MovementType, description: 'Filtrar por tipo de movimiento' })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z', description: 'Desde fecha (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59.000Z', description: 'Hasta fecha (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
