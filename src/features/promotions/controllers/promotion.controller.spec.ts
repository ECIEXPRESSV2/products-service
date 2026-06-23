import { Test, TestingModule } from '@nestjs/testing';
import { PromotionController } from './promotion.controller';
import { PROMOTION_SERVICE } from '../services/promotion.service.interface';
import type { IPromotionService } from '../services/promotion.service.interface';
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PromotionController', () => {
  let controller: PromotionController;
  let service: jest.Mocked<IPromotionService>;

  beforeEach(async () => {
    const serviceMock: jest.Mocked<IPromotionService> = {
      findAll: jest.fn(),
      findActive: jest.fn(),
      findByTarget: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      remove: jest.fn(),
      calculateEffectivePrice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotionController],
      providers: [{ provide: PROMOTION_SERVICE, useValue: serviceMock }],
    }).compile();

    controller = module.get(PromotionController);
    service = serviceMock;
  });

  describe('findAll — GET /promotions', () => {
    it('delegates to service.findAll with includeInactive=false by default', async () => {
      const promos = [makePromotion()];
      service.findAll.mockResolvedValue(promos);

      const result = await controller.findAll(STORE_ID);

      expect(service.findAll).toHaveBeenCalledWith(STORE_ID, false);
      expect(result).toBe(promos);
    });

    it('passes includeInactive=true when query param is "true"', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll(STORE_ID, 'true');

      expect(service.findAll).toHaveBeenCalledWith(STORE_ID, true);
    });
  });

  describe('findActive — GET /promotions/active', () => {
    it('delegates to service.findActive', async () => {
      const promos = [makePromotion()];
      service.findActive.mockResolvedValue(promos);

      const result = await controller.findActive(STORE_ID);

      expect(service.findActive).toHaveBeenCalledWith(STORE_ID);
      expect(result).toBe(promos);
    });
  });

  describe('findByTarget — GET /promotions/by-target', () => {
    it('delegates to service.findByTarget', async () => {
      const promos = [makePromotion()];
      service.findByTarget.mockResolvedValue(promos);

      const result = await controller.findByTarget(STORE_ID, PromotionScope.PRODUCT, PRODUCT_ID);

      expect(service.findByTarget).toHaveBeenCalledWith(STORE_ID, PromotionScope.PRODUCT, PRODUCT_ID);
      expect(result).toBe(promos);
    });
  });

  describe('calculateEffectivePrice — GET /promotions/effective-price', () => {
    it('delegates to service.calculateEffectivePrice', async () => {
      const priceResult = {
        basePrice: 3500,
        effectivePrice: 3000,
        discount: 500,
        appliedPromotion: makePromotion(),
      };
      service.calculateEffectivePrice.mockResolvedValue(priceResult);

      const result = await controller.calculateEffectivePrice(
        STORE_ID,
        PRODUCT_ID,
        CATEGORY_ID,
        3500,
      );

      expect(service.calculateEffectivePrice).toHaveBeenCalledWith(
        STORE_ID,
        PRODUCT_ID,
        CATEGORY_ID,
        3500,
      );
      expect(result).toBe(priceResult);
    });
  });

  describe('findById — GET /promotions/:id', () => {
    it('delegates to service.findById', async () => {
      const promo = makePromotion();
      service.findById.mockResolvedValue(promo);

      const result = await controller.findById(PROMO_ID);

      expect(service.findById).toHaveBeenCalledWith(PROMO_ID);
      expect(result).toBe(promo);
    });
  });

  describe('create — POST /promotions', () => {
    it('delegates to service.create and returns created promotion', async () => {
      const dto: CreatePromotionDto = {
        storeId: STORE_ID,
        name: '15% en Café',
        type: PromotionType.PERCENTAGE,
        value: 15,
        scope: PromotionScope.PRODUCT,
        targetId: PRODUCT_ID,
        startsAt: '2024-01-01T00:00:00.000Z',
      };
      const created = makePromotion();
      service.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto, undefined);
      expect(result).toBe(created);
    });
  });

  describe('update — PATCH /promotions/:id', () => {
    it('delegates to service.update', async () => {
      const updated = makePromotion({ name: 'Promo actualizada' });
      service.update.mockResolvedValue(updated);

      const result = await controller.update(PROMO_ID, { name: 'Promo actualizada' });

      expect(service.update).toHaveBeenCalledWith(PROMO_ID, { name: 'Promo actualizada' }, undefined);
      expect(result).toBe(updated);
    });
  });

  describe('activate — PATCH /promotions/:id/activate', () => {
    it('delegates to service.activate', async () => {
      const promo = makePromotion({ isActive: true });
      service.activate.mockResolvedValue(promo);

      const result = await controller.activate(PROMO_ID);

      expect(service.activate).toHaveBeenCalledWith(PROMO_ID);
      expect(result).toBe(promo);
    });
  });

  describe('deactivate — PATCH /promotions/:id/deactivate', () => {
    it('delegates to service.deactivate', async () => {
      const promo = makePromotion({ isActive: false });
      service.deactivate.mockResolvedValue(promo);

      const result = await controller.deactivate(PROMO_ID);

      expect(service.deactivate).toHaveBeenCalledWith(PROMO_ID);
      expect(result).toBe(promo);
    });
  });

  describe('remove — DELETE /promotions/:id', () => {
    it('delegates to service.remove', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(PROMO_ID);

      expect(service.remove).toHaveBeenCalledWith(PROMO_ID, undefined);
    });
  });
});
