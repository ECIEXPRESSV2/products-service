import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../entities/product.entity';

export class PaginatedProductResult {
  @ApiProperty({ type: [Product] })
  data: Product[];

  @ApiProperty({ example: 100, description: 'Total de registros que coinciden con el filtro' })
  total: number;

  @ApiProperty({ example: 1, description: 'Página actual' })
  page: number;

  @ApiProperty({ example: 20, description: 'Elementos por página' })
  limit: number;

  @ApiProperty({ example: 5, description: 'Total de páginas' })
  totalPages: number;
}
