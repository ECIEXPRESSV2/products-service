import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ProductService } from './product.service';
import { PRODUCT_REPOSITORY } from '../repositories/product.repository.interface';
import { IProductRepository } from '../repositories/product.repository.interface';
import { CATEGORY_REPOSITORY } from '../../categories/repositories/category.repository.interface';
import { ICategoryRepository } from '../../categories/repositories/category.repository.interface';
import { ProductPublisher } from '../../../messaging/publishers/product.publisher';
import { AuditService } from '../../audit/audit.service';
import { StoreValidator } from '../../stores/services/store-validator';
import { Product } from '../entities/product.entity';
import { Category } from '../../categories/entities/category.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { StockOperation } from '../dto/adjust-stock.dto';
import type { IInventoryService } from '../../inventory/services/inventory.service.interface';
import { INVENTORY_SERVICE } from '../../inventory/services/inventory.service.interface';
import { SharedEventPublisher } from '../../../messaging/shared-bus/shared-event-publisher.service';

const STORE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PRODUCT_ID = 'b2cc188e-9bf9-4888-aa12-ace4e6543111';
const CATEGORY_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: CATEGORY_ID,
    storeId: STORE_ID,
    name: 'Bebidas',
    slug: 'bebidas',
    description: null,
    parentId: null,
    parent: null,
    children: [],
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_ID,
    storeId: STORE_ID,
    categoryId: CATEGORY_ID,
    category: makeCategory(),
    name: 'Café Americano',
    slug: 'cafe-americano',
    description: null,
    price: '3500.00',
    sku: null,
    imageUrl: null,
    stock: 20,
    reservedStock: 0,
    minStock: 5,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
    ...overrides,
  };
}

describe('ProductService', () => {
  let service: ProductService;
  let repo: jest.Mocked<IProductRepository>;
  let categoryRepo: jest.Mocked<ICategoryRepository>;
  let publisher: jest.Mocked<ProductPublisher>;
  let auditService: jest.Mocked<AuditService>;
  let inventoryService: jest.Mocked<IInventoryService>;

  beforeEach(async () => {
    const repoMock: jest.Mocked<IProductRepository> = {
      findAll: jest.fn(),
      findAllPaginated: jest.fn(),
      findByCategory: jest.fn(),
      findByCategoryPaginated: jest.fn(),
      findLowStock: jest.fn(),
      search: jest.fn(),
      findById: jest.fn(),
      findBySlugAndStore: jest.fn(),
      findBySkuAndStore: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setStock: jest.fn(),
      adjustReservedStock: jest.fn(),
      setStockAndReserved: jest.fn(),
      setActive: jest.fn(),
      softDelete: jest.fn(),
      existsById: jest.fn(),
      countActiveByCategory: jest.fn(),
    };

    const categoryRepoMock: jest.Mocked<ICategoryRepository> = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlugAndStore: jest.fn(),
      findRootsByStore: jest.fn(),
      findChildrenOf: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      existsById: jest.fn(),
    };

    const publisherMock = {
      productCreated: jest.fn(),
      productUpdated: jest.fn(),
      productDeleted: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<ProductPublisher>;

    const auditMock = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const storeValidatorMock = {
      assertActive: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<StoreValidator>;

    const inventoryMock: jest.Mocked<IInventoryService> = {
      logMovement: jest.fn().mockResolvedValue(undefined),
      findByProduct: jest.fn(),
      findByStore: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };

    const loggerMock = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const sharedEventPublisherMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SharedEventPublisher>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PRODUCT_REPOSITORY, useValue: repoMock },
        { provide: CATEGORY_REPOSITORY, useValue: categoryRepoMock },
        { provide: ProductPublisher, useValue: publisherMock },
        { provide: AuditService, useValue: auditMock },
        { provide: StoreValidator, useValue: storeValidatorMock },
        { provide: INVENTORY_SERVICE, useValue: inventoryMock },
        { provide: SharedEventPublisher, useValue: sharedEventPublisherMock },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: loggerMock },
      ],
    }).compile();

    service = module.get(ProductService);
    repo = repoMock;
    categoryRepo = categoryRepoMock;
    publisher = publisherMock;
    auditService = auditMock;
    inventoryService = inventoryMock;
  });

  // ── findAll / findAllPaginated ───────────────────────────────────────────

  describe('findAll', () => {
    it('delegates to repository with storeId', async () => {
      const products = [makeProduct()];
      repo.findAll.mockResolvedValue(products);

      const result = await service.findAll(STORE_ID);

      expect(repo.findAll).toHaveBeenCalledWith(STORE_ID, false);
      expect(result).toBe(products);
    });

    it('passes includeInactive flag through to repository', async () => {
      repo.findAll.mockResolvedValue([]);

      await service.findAll(STORE_ID, true);

      expect(repo.findAll).toHaveBeenCalledWith(STORE_ID, true);
    });
  });

  describe('findAllPaginated', () => {
    it('delegates to repository with page and limit', async () => {
      const paginated = { data: [makeProduct()], total: 1, page: 2, limit: 10, totalPages: 1 };
      repo.findAllPaginated.mockResolvedValue(paginated);

      const result = await service.findAllPaginated(STORE_ID, 2, 10);

      expect(repo.findAllPaginated).toHaveBeenCalledWith(STORE_ID, 2, 10, false);
      expect(result).toBe(paginated);
    });
  });

  // ── findByCategory / findByCategoryPaginated ─────────────────────────────

  describe('findByCategory', () => {
    it('delegates to repository with storeId and categoryId', async () => {
      const products = [makeProduct()];
      repo.findByCategory.mockResolvedValue(products);

      const result = await service.findByCategory(STORE_ID, CATEGORY_ID);

      expect(repo.findByCategory).toHaveBeenCalledWith(STORE_ID, CATEGORY_ID, false);
      expect(result).toBe(products);
    });
  });

  describe('findByCategoryPaginated', () => {
    it('delegates to repository with all params', async () => {
      const paginated = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      repo.findByCategoryPaginated.mockResolvedValue(paginated);

      const result = await service.findByCategoryPaginated(STORE_ID, CATEGORY_ID, 1, 20);

      expect(repo.findByCategoryPaginated).toHaveBeenCalledWith(STORE_ID, CATEGORY_ID, 1, 20, false);
      expect(result).toBe(paginated);
    });
  });

  // ── search ───────────────────────────────────────────────────────────────

  describe('search', () => {
    it('delegates to repository with storeId and query string', async () => {
      const products = [makeProduct()];
      repo.search.mockResolvedValue(products);

      const result = await service.search(STORE_ID, 'café');

      expect(repo.search).toHaveBeenCalledWith(STORE_ID, 'café');
      expect(result).toBe(products);
    });
  });

  // ── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns product when found', async () => {
      const product = makeProduct();
      repo.findById.mockResolvedValue(product);

      await expect(service.findById(PRODUCT_ID)).resolves.toBe(product);
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── findLowStock ─────────────────────────────────────────────────────────

  describe('findLowStock', () => {
    it('delegates to repository', async () => {
      const lowProducts = [makeProduct({ stock: 2, minStock: 5 })];
      repo.findLowStock.mockResolvedValue(lowProducts);

      const result = await service.findLowStock(STORE_ID);

      expect(repo.findLowStock).toHaveBeenCalledWith(STORE_ID);
      expect(result).toBe(lowProducts);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateProductDto = {
      storeId: STORE_ID,
      categoryId: CATEGORY_ID,
      name: 'Café Americano',
      slug: 'cafe-americano',
      price: 3500,
    };

    it('creates product, saves audit log and publishes event', async () => {
      const created = makeProduct();
      categoryRepo.findById.mockResolvedValue(makeCategory());
      repo.findBySlugAndStore.mockResolvedValue(null);
      repo.findBySkuAndStore.mockResolvedValue(null);
      repo.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityName: 'Product' }),
      );
      expect(publisher.productCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: created.id }),
      );
      expect(result).toBe(created);
    });

    it('throws NotFoundException when category does not exist', async () => {
      categoryRepo.findById.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when category belongs to a different store', async () => {
      categoryRepo.findById.mockResolvedValue(makeCategory({ storeId: 'other-store-id' }));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when category is inactive', async () => {
      categoryRepo.findById.mockResolvedValue(makeCategory({ isActive: false }));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when slug already exists in store', async () => {
      categoryRepo.findById.mockResolvedValue(makeCategory());
      repo.findBySlugAndStore.mockResolvedValue(makeProduct({ id: 'other-product-id' }));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when SKU already exists in store', async () => {
      categoryRepo.findById.mockResolvedValue(makeCategory());
      repo.findBySlugAndStore.mockResolvedValue(null);
      repo.findBySkuAndStore.mockResolvedValue(makeProduct({ id: 'other-product-id' }));

      await expect(service.create({ ...dto, sku: 'CAF-001' })).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates product, saves audit log and publishes event', async () => {
      const before = makeProduct();
      const updated = makeProduct({ name: 'Café Premium' });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(updated);

      const result = await service.update(PRODUCT_ID, { name: 'Café Premium' });

      expect(repo.update).toHaveBeenCalledWith(PRODUCT_ID, { name: 'Café Premium' });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', entityName: 'Product' }),
      );
      expect(publisher.productUpdated).toHaveBeenCalled();
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update(PRODUCT_ID, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when repo.update returns null', async () => {
      repo.findById.mockResolvedValue(makeProduct());
      repo.update.mockResolvedValue(null);

      await expect(service.update(PRODUCT_ID, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('validates new categoryId belongs to the same store', async () => {
      repo.findById.mockResolvedValue(makeProduct());
      categoryRepo.findById.mockResolvedValue(makeCategory({ storeId: 'other-store' }));

      await expect(
        service.update(PRODUCT_ID, { categoryId: CATEGORY_ID }),
      ).rejects.toThrow(ConflictException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when new slug already taken in store', async () => {
      repo.findById.mockResolvedValue(makeProduct());
      repo.findBySlugAndStore.mockResolvedValue(makeProduct({ id: 'other-id', slug: 'nuevo-slug' }));

      await expect(
        service.update(PRODUCT_ID, { slug: 'nuevo-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows updating slug to the same value (own slug is not a conflict)', async () => {
      const product = makeProduct();
      const updated = makeProduct();
      repo.findById.mockResolvedValue(product);
      repo.update.mockResolvedValue(updated);

      await expect(
        service.update(PRODUCT_ID, { slug: product.slug }),
      ).resolves.toBe(updated);
      expect(repo.findBySlugAndStore).not.toHaveBeenCalled();
    });

    it('throws ConflictException when new SKU already taken in store', async () => {
      repo.findById.mockResolvedValue(makeProduct({ sku: 'CAF-001' }));
      repo.findBySkuAndStore.mockResolvedValue(makeProduct({ id: 'other-id', sku: 'CAF-002' }));

      await expect(
        service.update(PRODUCT_ID, { sku: 'CAF-002' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows updating SKU to the same value (own SKU is not a conflict)', async () => {
      const product = makeProduct({ sku: 'CAF-001' });
      const updated = makeProduct({ sku: 'CAF-001' });
      repo.findById.mockResolvedValue(product);
      repo.update.mockResolvedValue(updated);

      await expect(
        service.update(PRODUCT_ID, { sku: 'CAF-001' }),
      ).resolves.toBe(updated);
      expect(repo.findBySkuAndStore).not.toHaveBeenCalled();
    });
  });

  // ── activate / deactivate ────────────────────────────────────────────────

  describe('activate', () => {
    it('activates an inactive product and publishes event', async () => {
      const inactive = makeProduct({ isActive: false });
      const active = makeProduct({ isActive: true });
      repo.findById.mockResolvedValue(inactive);
      repo.setActive.mockResolvedValue(active);

      const result = await service.activate(PRODUCT_ID);

      expect(repo.setActive).toHaveBeenCalledWith(PRODUCT_ID, true);
      expect(publisher.productUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
      expect(result).toBe(active);
    });

    it('is idempotent — returns product without calling setActive when already active', async () => {
      repo.findById.mockResolvedValue(makeProduct({ isActive: true }));

      await service.activate(PRODUCT_ID);

      expect(repo.setActive).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.activate(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('deactivates an active product and publishes event', async () => {
      const active = makeProduct({ isActive: true });
      const inactive = makeProduct({ isActive: false });
      repo.findById.mockResolvedValue(active);
      repo.setActive.mockResolvedValue(inactive);

      const result = await service.deactivate(PRODUCT_ID);

      expect(repo.setActive).toHaveBeenCalledWith(PRODUCT_ID, false);
      expect(publisher.productUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(result).toBe(inactive);
    });

    it('is idempotent — returns product without calling setActive when already inactive', async () => {
      repo.findById.mockResolvedValue(makeProduct({ isActive: false }));

      await service.deactivate(PRODUCT_ID);

      expect(repo.setActive).not.toHaveBeenCalled();
    });
  });

  // ── adjustStock ──────────────────────────────────────────────────────────

  describe('adjustStock', () => {
    it('sets stock to exact value with SET operation', async () => {
      const product = makeProduct({ stock: 10, reservedStock: 0 });
      const updated = makeProduct({ stock: 50 });
      repo.findById.mockResolvedValue(product);
      repo.setStock.mockResolvedValue(updated);

      await service.adjustStock(PRODUCT_ID, { operation: StockOperation.SET, quantity: 50 });

      expect(repo.setStock).toHaveBeenCalledWith(PRODUCT_ID, 50);
    });

    it('adds units to current stock with ADD operation', async () => {
      const product = makeProduct({ stock: 10, reservedStock: 0 });
      repo.findById.mockResolvedValue(product);
      repo.setStock.mockResolvedValue(makeProduct({ stock: 25 }));

      await service.adjustStock(PRODUCT_ID, { operation: StockOperation.ADD, quantity: 15 });

      expect(repo.setStock).toHaveBeenCalledWith(PRODUCT_ID, 25);
    });

    it('subtracts units from current stock with SUBTRACT operation', async () => {
      const product = makeProduct({ stock: 20, reservedStock: 0 });
      repo.findById.mockResolvedValue(product);
      repo.setStock.mockResolvedValue(makeProduct({ stock: 12 }));

      await service.adjustStock(PRODUCT_ID, { operation: StockOperation.SUBTRACT, quantity: 8 });

      expect(repo.setStock).toHaveBeenCalledWith(PRODUCT_ID, 12);
    });

    it('throws ConflictException when SUBTRACT would result in negative stock', async () => {
      repo.findById.mockResolvedValue(makeProduct({ stock: 5, reservedStock: 0 }));

      await expect(
        service.adjustStock(PRODUCT_ID, { operation: StockOperation.SUBTRACT, quantity: 10 }),
      ).rejects.toThrow(ConflictException);
      expect(repo.setStock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when SUBTRACT would leave stock below reservedStock', async () => {
      repo.findById.mockResolvedValue(makeProduct({ stock: 10, reservedStock: 8 }));

      await expect(
        service.adjustStock(PRODUCT_ID, { operation: StockOperation.SUBTRACT, quantity: 5 }),
      ).rejects.toThrow(ConflictException);
      expect(repo.setStock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when SET value is below reservedStock', async () => {
      repo.findById.mockResolvedValue(makeProduct({ stock: 20, reservedStock: 10 }));

      await expect(
        service.adjustStock(PRODUCT_ID, { operation: StockOperation.SET, quantity: 5 }),
      ).rejects.toThrow(ConflictException);
      expect(repo.setStock).not.toHaveBeenCalled();
    });

    it('logs an inventory movement after a successful adjustment', async () => {
      const product = makeProduct({ stock: 10, reservedStock: 0 });
      repo.findById.mockResolvedValue(product);
      repo.setStock.mockResolvedValue(makeProduct({ stock: 20 }));

      await service.adjustStock(PRODUCT_ID, { operation: StockOperation.ADD, quantity: 10, notes: 'Reabastecimiento' });

      expect(inventoryService.logMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: PRODUCT_ID,
          quantity: 10,
          stockBefore: 10,
          stockAfter: 20,
          notes: 'Reabastecimiento',
        }),
      );
    });
  });

  // ── reserveStock ─────────────────────────────────────────────────────────

  describe('reserveStock', () => {
    it('increases reservedStock when available stock is sufficient', async () => {
      const product = makeProduct({ stock: 20, reservedStock: 5 });
      repo.findById.mockResolvedValue(product);
      repo.adjustReservedStock.mockResolvedValue(makeProduct({ stock: 20, reservedStock: 8 }));

      await service.reserveStock(PRODUCT_ID, 3, 'order-001');

      expect(repo.adjustReservedStock).toHaveBeenCalledWith(PRODUCT_ID, 8);
      expect(inventoryService.logMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: PRODUCT_ID,
          quantity: 3,
          stockBefore: 20,
          stockAfter: 20,
          reservedStockBefore: 5,
          reservedStockAfter: 8,
          referenceId: 'order-001',
        }),
      );
    });

    it('throws ConflictException when available stock is insufficient', async () => {
      // stock=10, reservedStock=8 → available=2, requesting 5
      repo.findById.mockResolvedValue(makeProduct({ stock: 10, reservedStock: 8 }));

      await expect(service.reserveStock(PRODUCT_ID, 5, 'order-001')).rejects.toThrow(ConflictException);
      expect(repo.adjustReservedStock).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.reserveStock(PRODUCT_ID, 1, 'order-001')).rejects.toThrow(NotFoundException);
    });
  });

  // ── releaseStock ─────────────────────────────────────────────────────────

  describe('releaseStock', () => {
    it('decreases reservedStock on cancellation', async () => {
      const product = makeProduct({ stock: 20, reservedStock: 5 });
      repo.findById.mockResolvedValue(product);
      repo.adjustReservedStock.mockResolvedValue(makeProduct({ stock: 20, reservedStock: 2 }));

      await service.releaseStock(PRODUCT_ID, 3, 'order-001');

      expect(repo.adjustReservedStock).toHaveBeenCalledWith(PRODUCT_ID, 2);
      expect(inventoryService.logMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 3,
          reservedStockBefore: 5,
          reservedStockAfter: 2,
          referenceId: 'order-001',
        }),
      );
    });

    it('clamps reservedStock to 0 when release quantity exceeds current reserved', async () => {
      repo.findById.mockResolvedValue(makeProduct({ stock: 20, reservedStock: 2 }));
      repo.adjustReservedStock.mockResolvedValue(makeProduct({ stock: 20, reservedStock: 0 }));

      await service.releaseStock(PRODUCT_ID, 10, 'order-001');

      expect(repo.adjustReservedStock).toHaveBeenCalledWith(PRODUCT_ID, 0);
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.releaseStock(PRODUCT_ID, 1, 'order-001')).rejects.toThrow(NotFoundException);
    });
  });

  // ── confirmReservation ───────────────────────────────────────────────────

  describe('confirmReservation', () => {
    it('decrements both stock and reservedStock on confirmed sale', async () => {
      const product = makeProduct({ stock: 20, reservedStock: 5 });
      repo.findById.mockResolvedValue(product);
      repo.setStockAndReserved.mockResolvedValue(makeProduct({ stock: 17, reservedStock: 2 }));

      await service.confirmReservation(PRODUCT_ID, 3, 'order-001');

      expect(repo.setStockAndReserved).toHaveBeenCalledWith(PRODUCT_ID, 17, 2);
      expect(inventoryService.logMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 3,
          stockBefore: 20,
          stockAfter: 17,
          reservedStockBefore: 5,
          reservedStockAfter: 2,
          referenceId: 'order-001',
        }),
      );
    });

    it('throws ConflictException when stock is insufficient to confirm', async () => {
      repo.findById.mockResolvedValue(makeProduct({ stock: 2, reservedStock: 2 }));

      await expect(service.confirmReservation(PRODUCT_ID, 5, 'order-001')).rejects.toThrow(ConflictException);
      expect(repo.setStockAndReserved).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.confirmReservation(PRODUCT_ID, 1, 'order-001')).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes product, saves audit log and publishes event', async () => {
      const product = makeProduct();
      repo.findById.mockResolvedValue(product);
      repo.softDelete.mockResolvedValue(true);

      await service.remove(PRODUCT_ID);

      expect(repo.softDelete).toHaveBeenCalledWith(PRODUCT_ID);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entityName: 'Product' }),
      );
      expect(publisher.productDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: PRODUCT_ID }),
      );
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.remove(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
