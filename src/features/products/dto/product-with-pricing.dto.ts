import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../entities/product.entity';

export class ProductWithPricingDto extends Product {
  @ApiProperty({
    example: 4050,
    description: 'Precio final tras aplicar la mejor promoción activa (igual a `price` si no hay ninguna)',
  })
  effectivePrice: number;

  @ApiProperty({ example: 450, description: 'Monto descontado respecto al precio base (0 si no hay promoción)' })
  discountAmount: number;
}
