import { PromotionScope, PromotionType } from '../../features/promotions/entities/promotion.entity';

export const PROMOTION_EVENTS = {
  CREATED: 'product.promotion.created',
  UPDATED: 'product.promotion.updated',
  DELETED: 'product.promotion.deleted',
} as const;

export interface PromotionCreatedPayload {
  id: string;
  storeId: string;
  name: string;
  type: PromotionType;
  value: string;
  scope: PromotionScope;
  targetId: string;
  startsAt: Date;
  endsAt: Date | null;
}

export interface PromotionUpdatedPayload {
  id: string;
  storeId: string;
  name?: string;
  type?: PromotionType;
  value?: string;
  scope?: PromotionScope;
  targetId?: string;
  startsAt?: Date;
  endsAt?: Date | null;
  isActive?: boolean;
}

export interface PromotionDeletedPayload {
  id: string;
  storeId: string;
}
