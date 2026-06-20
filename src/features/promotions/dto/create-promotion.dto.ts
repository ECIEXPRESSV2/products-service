import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PromotionScope, PromotionType } from '../entities/promotion.entity';

export class CreatePromotionDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: '15% en Café Americano', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Promo válida en horario de la mañana' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PromotionType, example: PromotionType.PERCENTAGE })
  @IsEnum(PromotionType)
  type: PromotionType;

  @ApiProperty({
    example: 15,
    description: 'Para PERCENTAGE: valor entre 0 y 100. Para FIXED_AMOUNT: monto a descontar.',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  value: number;

  @ApiProperty({ enum: PromotionScope, example: PromotionScope.PRODUCT })
  @IsEnum(PromotionScope)
  scope: PromotionScope;

  @ApiProperty({
    example: 'b2cc188e-9bf9-4888-aa12-ace4e6543111',
    description: 'UUID del producto o categoría al que aplica la promoción',
    format: 'uuid',
  })
  @IsUUID()
  targetId: string;

  @ApiProperty({ example: '2024-06-01T00:00:00.000Z', description: 'Inicio de vigencia (ISO 8601)' })
  @IsISO8601()
  startsAt: string;

  @ApiPropertyOptional({
    example: '2024-12-31T23:59:59.000Z',
    description: 'Fin de vigencia (ISO 8601). Omitir para sin vencimiento.',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
