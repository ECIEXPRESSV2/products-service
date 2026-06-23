import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PromotionService } from './promotion.service';
import { PROMOTION_REPOSITORY } from '../repositories/promotion.repository.interface';
import type { IPromotionRepository } from '../repositories/promotion.repository.interface';
import { PromotionPublisher } from '../../../messaging/publishers/promotion.publisher';
import { AuditService } from '../../audit/audit.service';
import { Promotion, PromotionScope, PromotionType } from '../entities/promotion.entity';
import { CreatePromotionDto } from '../dto/create-promotion.dto';

const STORE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PRODUCT_ID = 'b2cc188e-9bf9-4888-aa12-ace4e6543111';
const CATEGORY_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const PROMO_ID = 'c3dc299f-8bf9-4888-aa12-ace4e6543777';

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: PROMO_ID,
    storeId: STORE_ID,
    name: '15% en Café Americano',
    description: null,
    type: PromotionType.PERCENTAGE,
    value: '15.00',
    scope: PromotionScope.PRODUCT,
    targetId: PRODUCT_ID,
    startsAt: new Date('2024-01-01T00:00:00Z'),
    endsAt: null,
    isActive: true,
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
    ...overrides,
  };
}

describe('PromotionService', () => {
  let service: PromotionService;
  let repo: jest.Mocked<IPromotionRepository>;
  let publisher: jest.Mocked<PromotionPublisher>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const repoMock: jest.Mocked<IPromotionRepository> = {
      findAll: jest.fn(),
      findActive: jest.fn(),
      findByTarget: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      remove: jest.fn(),
      existsById: jest.fn(),
      findOverlapping: jest.fn().mockResolvedValue([]),
    };

    const publisherMock = {
      promotionCreated: jest.fn(),
      promotionUpdated: jest.fn(),
      promotionDeleted: jest.fn(),
    } as unknown as jest.Mocked<PromotionPublisher>;

    const auditMock = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const loggerMock = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionService,
        { provide: PROMOTION_REPOSITORY, useValue: repoMock },
        { provide: PromotionPublisher, useValue: publisherMock },
        { provide: AuditService, useValue: auditMock },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: loggerMock },
      ],
    }).compile();

    service = module.get(PromotionService);
    repo = repoMock;
    publisher = publisherMock;
    auditService = auditMock;
  });

  // ── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('delegates to repository with storeId', async () => {
      const promos = [makePromotion()];
      repo.findAll.mockResolvedValue(promos);

      const result = await service.findAll(STORE_ID);

      expect(repo.findAll).toHaveBeenCalledWith(STORE_ID, false);
      expect(result).toBe(promos);
    });

    it('passes includeInactive flag through', async () => {
      repo.findAll.mockResolvedValue([]);

      await service.findAll(STORE_ID, true);

      expect(repo.findAll).toHaveBeenCalledWith(STORE_ID, true);
    });
  });

  // ── findActive ───────────────────────────────────────────────────────────

  describe('findActive', () => {
    it('delegates to repository', async () => {
      const promos = [makePromotion()];
      repo.findActive.mockResolvedValue(promos);

      const result = await service.findActive(STORE_ID);

      expect(repo.findActive).toHaveBeenCalledWith(STORE_ID);
      expect(result).toBe(promos);
    });
  });

  // ── findByTarget ─────────────────────────────────────────────────────────

  describe('findByTarget', () => {
    it('delegates to repository with onlyActive=true', async () => {
      const promos = [makePromotion()];
      repo.findByTarget.mockResolvedValue(promos);

      const result = await service.findByTarget(STORE_ID, PromotionScope.PRODUCT, PRODUCT_ID);

      expect(repo.findByTarget).toHaveBeenCalledWith(STORE_ID, PromotionScope.PRODUCT, PRODUCT_ID, true);
      expect(result).toBe(promos);
    });
  });

  // ── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns promotion when found', async () => {
      const promo = makePromotion();
      repo.findById.mockResolvedValue(promo);

      await expect(service.findById(PROMO_ID)).resolves.toBe(promo);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById(PROMO_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto: CreatePromotionDto = {
      storeId: STORE_ID,
      name: '15% en Café',
      type: PromotionType.PERCENTAGE,
      value: 15,
      scope: PromotionScope.PRODUCT,
      targetId: PRODUCT_ID,
      startsAt: '2024-01-01T00:00:00.000Z',
    };

    it('creates promotion, saves audit log and publishes event', async () => {
      const created = makePromotion();
      repo.create.mockResolvedValue(created);

      const result = await service.create(baseDto);

      expect(repo.create).toHaveBeenCalledWith(baseDto);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityName: 'Promotion' }),
      );
      expect(publisher.promotionCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: created.id, storeId: STORE_ID }),
      );
      expect(result).toBe(created);
    });

    it('throws BadRequestException when PERCENTAGE value exceeds 100', async () => {
      await expect(
        service.create({ ...baseDto, type: PromotionType.PERCENTAGE, value: 110 }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when value is negative', async () => {
      await expect(
        service.create({ ...baseDto, value: -5 }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when endsAt is before startsAt', async () => {
      await expect(
        service.create({
          ...baseDto,
          startsAt: '2024-06-01T00:00:00.000Z',
          endsAt: '2024-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('allows FIXED_AMOUNT with any positive value', async () => {
      const created = makePromotion({ type: PromotionType.FIXED_AMOUNT, value: '500.00' });
      repo.create.mockResolvedValue(created);

      await expect(
        service.create({ ...baseDto, type: PromotionType.FIXED_AMOUNT, value: 500 }),
      ).resolves.toBe(created);
    });

    it('allows promotion without endsAt (no expiry)', async () => {
      const created = makePromotion({ endsAt: null });
      repo.create.mockResolvedValue(created);

      await expect(service.create(baseDto)).resolves.toBe(created);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates promotion, saves audit log and publishes event', async () => {
      const before = makePromotion();
      const updated = makePromotion({ name: 'Promo actualizada' });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(updated);

      const result = await service.update(PROMO_ID, { name: 'Promo actualizada' });

      expect(repo.update).toHaveBeenCalledWith(PROMO_ID, { name: 'Promo actualizada' });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', entityName: 'Promotion' }),
      );
      expect(publisher.promotionUpdated).toHaveBeenCalled();
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when promotion does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update(PROMO_ID, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when updating PERCENTAGE value above 100', async () => {
      repo.findById.mockResolvedValue(makePromotion({ type: PromotionType.PERCENTAGE }));

      await expect(
        service.update(PROMO_ID, { value: 150 }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  // ── activate / deactivate ────────────────────────────────────────────────

  describe('activate', () => {
    it('activates an inactive promotion and publishes event', async () => {
      const inactive = makePromotion({ isActive: false });
      const active = makePromotion({ isActive: true });
      repo.findById.mockResolvedValue(inactive);
      repo.setActive.mockResolvedValue(active);

      const result = await service.activate(PROMO_ID);

      expect(repo.setActive).toHaveBeenCalledWith(PROMO_ID, true);
      expect(publisher.promotionUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
      expect(result).toBe(active);
    });

    it('is idempotent — returns promotion without calling setActive when already active', async () => {
      repo.findById.mockResolvedValue(makePromotion({ isActive: true }));

      await service.activate(PROMO_ID);

      expect(repo.setActive).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when promotion does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.activate(PROMO_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('deactivates an active promotion and publishes event', async () => {
      const active = makePromotion({ isActive: true });
      const inactive = makePromotion({ isActive: false });
      repo.findById.mockResolvedValue(active);
      repo.setActive.mockResolvedValue(inactive);

      const result = await service.deactivate(PROMO_ID);

      expect(repo.setActive).toHaveBeenCalledWith(PROMO_ID, false);
      expect(publisher.promotionUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(result).toBe(inactive);
    });

    it('is idempotent — returns promotion without calling setActive when already inactive', async () => {
      repo.findById.mockResolvedValue(makePromotion({ isActive: false }));

      await service.deactivate(PROMO_ID);

      expect(repo.setActive).not.toHaveBeenCalled();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes promotion, saves audit log and publishes event', async () => {
      const promo = makePromotion();
      repo.findById.mockResolvedValue(promo);
      repo.remove.mockResolvedValue(true);

      await service.remove(PROMO_ID);

      expect(repo.remove).toHaveBeenCalledWith(PROMO_ID);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entityName: 'Promotion' }),
      );
      expect(publisher.promotionDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: PROMO_ID }),
      );
    });

    it('throws NotFoundException when promotion does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.remove(PROMO_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── calculateEffectivePrice ──────────────────────────────────────────────

  describe('calculateEffectivePrice', () => {
    it('returns base price unchanged when no active promotions exist', async () => {
      repo.findByTarget.mockResolvedValue([]);

      const result = await service.calculateEffectivePrice(STORE_ID, PRODUCT_ID, CATEGORY_ID, 3500);

      expect(result).toEqual({
        basePrice: 3500,
        effectivePrice: 3500,
        discount: 0,
        appliedPromotion: null,
      });
    });

    it('applies PERCENTAGE discount and rounds up to nearest 50', async () => {
      const promo = makePromotion({ type: PromotionType.PERCENTAGE, value: '15.00' });
      repo.findByTarget.mockImplementation((storeId, scope) =>
        scope === PromotionScope.PRODUCT ? Promise.resolve([promo]) : Promise.resolve([]),
      );

      const result = await service.calculateEffectivePrice(STORE_ID, PRODUCT_ID, CATEGORY_ID, 3500);

      // 3500 * 0.15 = 525 → raw = 2975 → ceil(2975/50)*50 = 3000
      expect(result.effectivePrice).toBe(3000);
      expect(result.discount).toBe(500); // 3500 - 3000
      expect(result.appliedPromotion).toBe(promo);
    });

    it('applies FIXED_AMOUNT discount and rounds up to nearest 50', async () => {
      const promo = makePromotion({ type: PromotionType.FIXED_AMOUNT, value: '300.00' });
      repo.findByTarget.mockImplementation((storeId, scope) =>
        scope === PromotionScope.PRODUCT ? Promise.resolve([promo]) : Promise.resolve([]),
      );

      const result = await service.calculateEffectivePrice(STORE_ID, PRODUCT_ID, CATEGORY_ID, 3500);

      // 3500 - 300 = 3200 → ceil(3200/50)*50 = 3200 (already multiple of 50)
      expect(result.effectivePrice).toBe(3200);
      expect(result.discount).toBe(300);
    });

    it('applies category-level promotion when no product-level promotion exists', async () => {
      const categoryPromo = makePromotion({
        scope: PromotionScope.CATEGORY,
        targetId: CATEGORY_ID,
        type: PromotionType.PERCENTAGE,
        value: '10.00',
      });
      repo.findByTarget.mockImplementation((storeId, scope) =>
        scope === PromotionScope.CATEGORY
          ? Promise.resolve([categoryPromo])
          : Promise.resolve([]),
      );

      const result = await service.calculateEffectivePrice(STORE_ID, PRODUCT_ID, CATEGORY_ID, 1000);

      // 1000 * 0.10 = 100 → raw = 900 → ceil(900/50)*50 = 900
      expect(result.effectivePrice).toBe(900);
      expect(result.appliedPromotion).toBe(categoryPromo);
    });

    it('applies the best (highest discount) promotion when multiple exist', async () => {
      const weakPromo = makePromotion({ type: PromotionType.FIXED_AMOUNT, value: '200.00' });
      const strongPromo = makePromotion({ type: PromotionType.PERCENTAGE, value: '20.00' });
      repo.findByTarget.mockImplementation((storeId, scope) =>
        scope === PromotionScope.PRODUCT
          ? Promise.resolve([weakPromo, strongPromo])
          : Promise.resolve([]),
      );

      const result = await service.calculateEffectivePrice(STORE_ID, PRODUCT_ID, CATEGORY_ID, 2000);

      // FIXED 200 → discount 200; PERCENTAGE 20% → discount 400 (best)
      // raw = 2000 - 400 = 1600 → ceil(1600/50)*50 = 1600
      expect(result.appliedPromotion).toBe(strongPromo);
      expect(result.effectivePrice).toBe(1600);
    });

    it('clamps effectivePrice to 0 when discount exceeds basePrice', async () => {
      const promo = makePromotion({ type: PromotionType.FIXED_AMOUNT, value: '5000.00' });
      repo.findByTarget.mockImplementation((storeId, scope) =>
        scope === PromotionScope.PRODUCT ? Promise.resolve([promo]) : Promise.resolve([]),
      );

      const result = await service.calculateEffectivePrice(STORE_ID, PRODUCT_ID, CATEGORY_ID, 1000);

      expect(result.effectivePrice).toBe(0);
    });

    it('price already a multiple of 50 is not rounded further', async () => {
      const promo = makePromotion({ type: PromotionType.FIXED_AMOUNT, value: '500.00' });
      repo.findByTarget.mockImplementation((storeId, scope) =>
        scope === PromotionScope.PRODUCT ? Promise.resolve([promo]) : Promise.resolve([]),
      );

      const result = await service.calculateEffectivePrice(STORE_ID, PRODUCT_ID, CATEGORY_ID, 2000);

      // 2000 - 500 = 1500 → ceil(1500/50)*50 = 1500
      expect(result.effectivePrice).toBe(1500);
      expect(result.discount).toBe(500);
    });
  });
});
