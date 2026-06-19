import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { INVENTORY_SERVICE } from '../services/inventory.service.interface';
import type { IInventoryService } from '../services/inventory.service.interface';
import { InventoryMovement, MovementType } from '../entities/inventory-movement.entity';

const PRODUCT_ID = 'b2cc188e-9bf9-4888-aa12-ace4e6543111';
const STORE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const MOVEMENT_ID = 'd4ec388e-9bf9-4888-aa12-ace4e6543999';

function makeMovement(overrides: Partial<InventoryMovement> = {}): InventoryMovement {
  return {
    id: MOVEMENT_ID,
    productId: PRODUCT_ID,
    storeId: STORE_ID,
    type: MovementType.PURCHASE,
    quantity: 10,
    stockBefore: 40,
    stockAfter: 50,
    reservedStockBefore: 0,
    reservedStockAfter: 0,
    referenceId: null,
    notes: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: jest.Mocked<IInventoryService>;

  beforeEach(async () => {
    const serviceMock: jest.Mocked<IInventoryService> = {
      logMovement: jest.fn(),
      findByProduct: jest.fn(),
      findByStore: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: INVENTORY_SERVICE, useValue: serviceMock }],
    }).compile();

    controller = module.get(InventoryController);
    service = serviceMock;
  });

  // ── find — GET /inventory/movements ──────────────────────────────────────

  describe('find', () => {
    it('delegates to service.find with empty filters when no query params', async () => {
      service.find.mockResolvedValue([]);

      await controller.find({});

      expect(service.find).toHaveBeenCalledWith({
        productId: undefined,
        storeId: undefined,
        type: undefined,
        from: undefined,
        to: undefined,
      });
    });

    it('passes all filters to service.find including parsed dates', async () => {
      const movements = [makeMovement()];
      service.find.mockResolvedValue(movements);

      const result = await controller.find({
        productId: PRODUCT_ID,
        storeId: STORE_ID,
        type: MovementType.SALE,
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-12-31T23:59:59.000Z',
      });

      expect(service.find).toHaveBeenCalledWith({
        productId: PRODUCT_ID,
        storeId: STORE_ID,
        type: MovementType.SALE,
        from: new Date('2024-01-01T00:00:00.000Z'),
        to: new Date('2024-12-31T23:59:59.000Z'),
      });
      expect(result).toBe(movements);
    });
  });

  // ── findByProduct — GET /inventory/movements/product/:productId ───────────

  describe('findByProduct', () => {
    it('delegates to service.findByProduct with productId only', async () => {
      const movements = [makeMovement()];
      service.findByProduct.mockResolvedValue(movements);

      const result = await controller.findByProduct(PRODUCT_ID);

      expect(service.findByProduct).toHaveBeenCalledWith(
        PRODUCT_ID,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toBe(movements);
    });

    it('passes type and date range filters when provided', async () => {
      service.findByProduct.mockResolvedValue([]);

      await controller.findByProduct(
        PRODUCT_ID,
        MovementType.RESERVATION,
        '2024-01-01T00:00:00.000Z',
        '2024-06-30T23:59:59.000Z',
      );

      expect(service.findByProduct).toHaveBeenCalledWith(
        PRODUCT_ID,
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-06-30T23:59:59.000Z'),
        MovementType.RESERVATION,
      );
    });
  });

  // ── findByStore — GET /inventory/movements/store/:storeId ────────────────

  describe('findByStore', () => {
    it('delegates to service.findByStore with storeId only', async () => {
      const movements = [makeMovement()];
      service.findByStore.mockResolvedValue(movements);

      const result = await controller.findByStore(STORE_ID);

      expect(service.findByStore).toHaveBeenCalledWith(
        STORE_ID,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toBe(movements);
    });

    it('passes type filter when provided', async () => {
      service.findByStore.mockResolvedValue([]);

      await controller.findByStore(STORE_ID, MovementType.ADJUSTMENT);

      expect(service.findByStore).toHaveBeenCalledWith(
        STORE_ID,
        undefined,
        undefined,
        MovementType.ADJUSTMENT,
      );
    });
  });

  // ── findById — GET /inventory/movements/:id ───────────────────────────────

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const movement = makeMovement();
      service.findById.mockResolvedValue(movement);

      const result = await controller.findById(MOVEMENT_ID);

      expect(service.findById).toHaveBeenCalledWith(MOVEMENT_ID);
      expect(result).toBe(movement);
    });
  });
});
