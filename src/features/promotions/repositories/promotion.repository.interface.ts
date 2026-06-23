import { Promotion, PromotionScope } from '../entities/promotion.entity';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';

export interface IPromotionRepository {
  findAll(storeId: string, includeInactive?: boolean): Promise<Promotion[]>;
  findActive(storeId: string): Promise<Promotion[]>;
  findByTarget(
    storeId: string,
    scope: PromotionScope,
    targetId: string,
    onlyActive?: boolean,
  ): Promise<Promotion[]>;
  findById(id: string): Promise<Promotion | null>;
  findOverlapping(
    storeId: string,
    scope: PromotionScope,
    targetId: string,
    startsAt: Date,
    endsAt: Date | null,
    excludeId?: string,
  ): Promise<Promotion[]>;
  create(dto: CreatePromotionDto): Promise<Promotion>;
  update(id: string, dto: UpdatePromotionDto): Promise<Promotion | null>;
  setActive(id: string, isActive: boolean): Promise<Promotion | null>;
  remove(id: string): Promise<boolean>;
  existsById(id: string): Promise<boolean>;
}

export const PROMOTION_REPOSITORY = Symbol('IPromotionRepository');
