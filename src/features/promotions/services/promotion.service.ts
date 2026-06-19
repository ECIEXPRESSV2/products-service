import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { EffectivePriceResult, IPromotionService } from './promotion.service.interface';
import type { IPromotionRepository } from '../repositories/promotion.repository.interface';
import { PROMOTION_REPOSITORY } from '../repositories/promotion.repository.interface';
import { Promotion, PromotionScope, PromotionType } from '../entities/promotion.entity';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';
import { PromotionPublisher } from '../../../messaging/publishers/promotion.publisher';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

@Injectable()
export class PromotionService implements IPromotionService {
  constructor(
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: IPromotionRepository,
    private readonly publisher: PromotionPublisher,
    private readonly auditService: AuditService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  findAll(storeId: string, includeInactive = false): Promise<Promotion[]> {
    this.logger.log(`Listing promotions store=${storeId}`, PromotionService.name);
    return this.promotionRepository.findAll(storeId, includeInactive);
  }

  findActive(storeId: string): Promise<Promotion[]> {
    this.logger.log(`Listing active promotions store=${storeId}`, PromotionService.name);
    return this.promotionRepository.findActive(storeId);
  }

  findByTarget(storeId: string, scope: PromotionScope, targetId: string): Promise<Promotion[]> {
    this.logger.log(`Listing promotions scope=${scope} target=${targetId}`, PromotionService.name);
    return this.promotionRepository.findByTarget(storeId, scope, targetId, true);
  }

  async findById(id: string): Promise<Promotion> {
    const promotion = await this.promotionRepository.findById(id);
    if (!promotion) {
      this.logger.warn(`Promotion not found: ${id}`, PromotionService.name);
      throw new NotFoundException(`Promoción con id "${id}" no encontrada`);
    }
    return promotion;
  }

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    this.logger.log(`Creating promotion name="${dto.name}" store=${dto.storeId}`, PromotionService.name);

    this.assertValidValue(dto.type, dto.value);
    if (dto.endsAt) {
      this.assertValidDateRange(dto.startsAt, dto.endsAt);
    }

    const promotion = await this.promotionRepository.create(dto);

    this.logger.log(`Promotion created id=${promotion.id}`, PromotionService.name);

    await this.auditService.log({
      entityName: 'Promotion',
      entityId: promotion.id,
      action: AuditAction.CREATE,
      afterData: this.toAuditData(promotion),
    });

    this.publisher.promotionCreated({
      id: promotion.id,
      storeId: promotion.storeId,
      name: promotion.name,
      type: promotion.type,
      value: promotion.value,
      scope: promotion.scope,
      targetId: promotion.targetId,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
    });

    return promotion;
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<Promotion> {
    this.logger.log(`Updating promotion id=${id}`, PromotionService.name);
    const before = await this.findById(id);

    const targetType = dto.type ?? before.type;
    const targetValue = dto.value ?? parseFloat(before.value);
    this.assertValidValue(targetType, targetValue);

    const targetStartsAt = dto.startsAt ?? before.startsAt.toISOString();
    const targetEndsAt = dto.endsAt !== undefined ? dto.endsAt : before.endsAt?.toISOString();
    if (targetEndsAt) {
      this.assertValidDateRange(targetStartsAt, targetEndsAt);
    }

    const updated = await this.promotionRepository.update(id, dto);
    if (!updated) throw new NotFoundException(`Promoción con id "${id}" no encontrada`);

    await this.auditService.log({
      entityName: 'Promotion',
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: this.toAuditData(before),
      afterData: this.toAuditData(updated),
    });

    this.publisher.promotionUpdated({
      id,
      storeId: updated.storeId,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.value !== undefined && { value: String(dto.value) }),
      ...(dto.scope !== undefined && { scope: dto.scope }),
      ...(dto.targetId !== undefined && { targetId: dto.targetId }),
      ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
      ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return updated;
  }

  async activate(id: string): Promise<Promotion> {
    const before = await this.findById(id);
    if (before.isActive) return before;
    const updated = await this.promotionRepository.setActive(id, true);
    if (!updated) throw new NotFoundException(`Promoción con id "${id}" no encontrada`);
    await this.auditService.log({
      entityName: 'Promotion',
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: this.toAuditData(before),
      afterData: this.toAuditData(updated),
    });
    this.publisher.promotionUpdated({ id, storeId: updated.storeId, isActive: true });
    return updated;
  }

  async deactivate(id: string): Promise<Promotion> {
    const before = await this.findById(id);
    if (!before.isActive) return before;
    const updated = await this.promotionRepository.setActive(id, false);
    if (!updated) throw new NotFoundException(`Promoción con id "${id}" no encontrada`);
    await this.auditService.log({
      entityName: 'Promotion',
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: this.toAuditData(before),
      afterData: this.toAuditData(updated),
    });
    this.publisher.promotionUpdated({ id, storeId: updated.storeId, isActive: false });
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing promotion id=${id}`, PromotionService.name);
    const promotion = await this.findById(id);
    await this.promotionRepository.remove(id);
    await this.auditService.log({
      entityName: 'Promotion',
      entityId: id,
      action: AuditAction.DELETE,
      beforeData: this.toAuditData(promotion),
    });
    this.publisher.promotionDeleted({ id, storeId: promotion.storeId });
  }

  async calculateEffectivePrice(
    storeId: string,
    productId: string,
    categoryId: string,
    basePrice: number,
  ): Promise<EffectivePriceResult> {
    const [productPromos, categoryPromos] = await Promise.all([
      this.promotionRepository.findByTarget(storeId, PromotionScope.PRODUCT, productId, true),
      this.promotionRepository.findByTarget(storeId, PromotionScope.CATEGORY, categoryId, true),
    ]);

    const allPromos = [...productPromos, ...categoryPromos];

    if (allPromos.length === 0) {
      return { basePrice, effectivePrice: basePrice, discount: 0, appliedPromotion: null };
    }

    let bestDiscount = 0;
    let bestPromotion: Promotion | null = null;

    for (const promo of allPromos) {
      const value = parseFloat(promo.value);
      const discount =
        promo.type === PromotionType.PERCENTAGE
          ? basePrice * (value / 100)
          : Math.min(value, basePrice);

      if (discount > bestDiscount) {
        bestDiscount = discount;
        bestPromotion = promo;
      }
    }

    const rawPrice = Math.max(0, basePrice - bestDiscount);
    const effectivePrice = Math.ceil(rawPrice / 50) * 50;

    return {
      basePrice,
      effectivePrice,
      discount: Math.round((basePrice - effectivePrice) * 100) / 100,
      appliedPromotion: bestPromotion,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private assertValidValue(type: PromotionType, value: number): void {
    if (type === PromotionType.PERCENTAGE && (value < 0 || value > 100)) {
      throw new BadRequestException('Para descuentos porcentuales el valor debe estar entre 0 y 100');
    }
    if (value < 0) {
      throw new BadRequestException('El valor de la promoción no puede ser negativo');
    }
  }

  private assertValidDateRange(startsAt: string, endsAt: string): void {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
    }
  }

  private toAuditData(p: Promotion): Record<string, unknown> {
    return {
      id: p.id,
      storeId: p.storeId,
      name: p.name,
      type: p.type,
      value: p.value,
      scope: p.scope,
      targetId: p.targetId,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      isActive: p.isActive,
    };
  }
}
