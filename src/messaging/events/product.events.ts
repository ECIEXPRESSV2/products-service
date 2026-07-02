export const PRODUCT_EVENTS = {
  CREATED: 'product.item.created',
  UPDATED: 'product.item.updated',
  DELETED: 'product.item.deleted',
} as const;

export type ProductGenerationStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface ProductCreatedPayload {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  slug: string;
  price: string;
  sku: string | null;
  stock: number;
  imageUrl?: string | null;
  frontImageUrl?: string | null;
  leftImageUrl?: string | null;
  backImageUrl?: string | null;
  model3dUrl?: string | null;
  modelGenerationStatus?: ProductGenerationStatus;
  modelGenerationProgress?: number | null;
  modelGenerationError?: string | null;
}

export interface ProductUpdatedPayload {
  id: string;
  storeId: string;
  categoryId?: string;
  name?: string;
  slug?: string;
  price?: number;
  sku?: string;
  stock?: number;
  isActive?: boolean;
  imageUrl?: string | null;
  frontImageUrl?: string | null;
  leftImageUrl?: string | null;
  backImageUrl?: string | null;
  model3dUrl?: string | null;
  modelGenerationStatus?: ProductGenerationStatus;
  modelGenerationProgress?: number | null;
  modelGenerationError?: string | null;
}

export interface ProductDeletedPayload {
  id: string;
  storeId: string;
}
