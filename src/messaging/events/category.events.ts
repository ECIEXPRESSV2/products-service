export const CATEGORY_EVENTS = {
  CREATED: 'product.category.created',
  UPDATED: 'product.category.updated',
  DELETED: 'product.category.deleted',
} as const;

export interface CategoryCreatedPayload {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface CategoryUpdatedPayload {
  id: string;
  storeId: string;
  name?: string;
  slug?: string;
  parentId?: string | null;
  isActive?: boolean;
}

export interface CategoryDeletedPayload {
  id: string;
  storeId: string;
}
