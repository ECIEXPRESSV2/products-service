import { Promotion, PromotionScope } from '../entities/promotion.entity';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';

export interface EffectivePriceResult {
  basePrice: number;
  effectivePrice: number;
  discount: number;
  appliedPromotion: Promotion | null;
}

export interface IPromotionService {
  findAll(storeId: string, includeInactive?: boolean): Promise<Promotion[]>;
  findActive(storeId: string): Promise<Promotion[]>;
  findByTarget(storeId: string, scope: PromotionScope, targetId: string): Promise<Promotion[]>;
  findById(id: string): Promise<Promotion>;
  create(dto: CreatePromotionDto): Promise<Promotion>;
  update(id: string, dto: UpdatePromotionDto): Promise<Promotion>;
  activate(id: string): Promise<Promotion>;
  deactivate(id: string): Promise<Promotion>;
  remove(id: string): Promise<void>;
  calculateEffectivePrice(
    storeId: string,
    productId: string,
    categoryId: string,
    basePrice: number,
  ): Promise<EffectivePriceResult>;
}

export const PROMOTION_SERVICE = Symbol('IPromotionService');
