import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum StockOperation {
  SET = 'set',
  ADD = 'add',
  SUBTRACT = 'subtract',
}

export class AdjustStockDto {
  @ApiProperty({
    enum: StockOperation,
    example: StockOperation.ADD,
    description:
      '`set` reemplaza el stock; `add` suma unidades; `subtract` resta unidades (falla si el resultado sería negativo)',
  })
  @IsEnum(StockOperation)
  operation: StockOperation;

  @ApiProperty({
    example: 10,
    description: 'Cantidad de unidades a operar',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({
    example: 'Reabastecimiento semanal',
    description: 'Nota opcional registrada en el historial de inventario',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
