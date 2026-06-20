export const PRODUCT_EVENTS = {
  CREATED: 'product.item.created',
  UPDATED: 'product.item.updated',
  DELETED: 'product.item.deleted',
} as const;

export interface ProductCreatedPayload {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  slug: string;
  price: string;
  sku: string | null;
  stock: number;
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
}

export interface ProductDeletedPayload {
  id: string;
  storeId: string;
}
