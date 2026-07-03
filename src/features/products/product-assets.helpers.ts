import type { Product } from './entities/product.entity';

export const pickProductImageUrl = (product: Pick<Product, 'imageUrl' | 'frontImageUrl'>): string | null =>
  product.frontImageUrl ?? product.imageUrl ?? null;
