import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { InventoryService } from './inventory.service';
import { INVENTORY_MOVEMENT_REPOSITORY } from '../repositories/inventory-movement.repository.interface';
import type { IInventoryMovementRepository, LogMovementData } from '../repositories/inventory-movement.repository.interface';
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
    createdAt: new Date('2024-01-15T10:30:00Z'),
    ...overrides,
  };
}

function makeLogData(overrides: Partial<LogMovementData> = {}): LogMovementData {
  return {
    productId: PRODUCT_ID,
    storeId: STORE_ID,
    type: MovementType.PURCHASE,
    quantity: 10,
    stockBefore: 40,
    stockAfter: 50,
    reservedStockBefore: 0,
    reservedStockAfter: 0,
    ...overrides,
  };
}

describe('InventoryService', () => {
  let service: InventoryService;
  let repo: jest.Mocked<IInventoryMovementRepository>;

  beforeEach(async () => {
    const repoMock: jest.Mocked<IInventoryMovementRepository> = {
      log: jest.fn(),
      findByProduct: jest.fn(),
      findByStore: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };

    const loggerMock = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: INVENTORY_MOVEMENT_REPOSITORY, useValue: repoMock },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: loggerMock },
      ],
    }).compile();

    service = module.get(InventoryService);
    repo = repoMock;
  });

  // ── logMovement ──────────────────────────────────────────────────────────

  describe('logMovement', () => {
    it('persists the movement via repository', async () => {
      const movement = makeMovement();
      repo.log.mockResolvedValue(movement);
      const data = makeLogData();

      await service.logMovement(data);

      expect(repo.log).toHaveBeenCalledWith(data);
    });

    it('does not throw when repository.log fails', async () => {
      repo.log.mockRejectedValue(new Error('DB error'));

      await expect(service.logMovement(makeLogData())).resolves.toBeUndefined();
    });

    it('logs all movement types without throwing', async () => {
      repo.log.mockResolvedValue(makeMovement());

      for (const type of Object.values(MovementType)) {
        await expect(service.logMovement(makeLogData({ type }))).resolves.toBeUndefined();
      }
    });
  });

  // ── findByProduct ────────────────────────────────────────────────────────

  describe('findByProduct', () => {
    it('delegates to repository with productId', async () => {
      const movements = [makeMovement()];
      repo.findByProduct.mockResolvedValue(movements);

      const result = await service.findByProduct(PRODUCT_ID);

      expect(repo.findByProduct).toHaveBeenCalledWith(PRODUCT_ID, undefined, undefined, undefined);
      expect(result).toBe(movements);
    });

    it('passes date range and type filters to repository', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      repo.findByProduct.mockResolvedValue([]);

      await service.findByProduct(PRODUCT_ID, from, to, MovementType.SALE);

      expect(repo.findByProduct).toHaveBeenCalledWith(
        PRODUCT_ID,
        from,
        to,
        MovementType.SALE,
      );
    });
  });

  // ── findByStore ──────────────────────────────────────────────────────────

  describe('findByStore', () => {
    it('delegates to repository with storeId', async () => {
      const movements = [makeMovement()];
      repo.findByStore.mockResolvedValue(movements);

      const result = await service.findByStore(STORE_ID);

      expect(repo.findByStore).toHaveBeenCalledWith(STORE_ID, undefined, undefined, undefined);
      expect(result).toBe(movements);
    });
  });

  // ── find ─────────────────────────────────────────────────────────────────

  describe('find', () => {
    it('delegates to repository with all filters', async () => {
      const movements = [makeMovement()];
      repo.find.mockResolvedValue(movements);
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');

      const result = await service.find({
        productId: PRODUCT_ID,
        storeId: STORE_ID,
        type: MovementType.RESERVATION,
        from,
        to,
      });

      expect(repo.find).toHaveBeenCalledWith({
        productId: PRODUCT_ID,
        storeId: STORE_ID,
        type: MovementType.RESERVATION,
        from,
        to,
      });
      expect(result).toBe(movements);
    });

    it('delegates to repository with empty filters', async () => {
      repo.find.mockResolvedValue([]);

      await service.find({});

      expect(repo.find).toHaveBeenCalledWith({});
    });
  });

  // ── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns movement when found', async () => {
      const movement = makeMovement();
      repo.findById.mockResolvedValue(movement);

      await expect(service.findById(MOVEMENT_ID)).resolves.toBe(movement);
    });

    it('throws NotFoundException when movement does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById(MOVEMENT_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
