import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CategoryService } from './category.service';
import { CATEGORY_REPOSITORY } from '../repositories/category.repository.interface';
import { ICategoryRepository } from '../repositories/category.repository.interface';
import { CategoryPublisher } from '../../../messaging/publishers/category.publisher';
import { AuditService } from '../../audit/audit.service';
import { StoreValidator } from '../../stores/services/store-validator';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { PRODUCT_REPOSITORY } from '../../products/repositories/product.repository.interface';
import type { IProductRepository } from '../../products/repositories/product.repository.interface';

const STORE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const CAT_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: CAT_ID,
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

describe('CategoryService', () => {
  let service: CategoryService;
  let repo: jest.Mocked<ICategoryRepository>;
  let productRepo: jest.Mocked<IProductRepository>;
  let publisher: jest.Mocked<CategoryPublisher>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const repoMock: jest.Mocked<ICategoryRepository> = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlugAndStore: jest.fn(),
      findRootsByStore: jest.fn(),
      findChildrenOf: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
      existsById: jest.fn(),
    };

    const productRepoMock: jest.Mocked<IProductRepository> = {
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
      tryReserveStock: jest.fn(),
      confirmSale: jest.fn(),
      releaseReservation: jest.fn(),
      incrementStock: jest.fn(),
      setActive: jest.fn(),
      deleteById: jest.fn(),
      existsById: jest.fn(),
      countActiveByCategory: jest.fn().mockResolvedValue(0),
      countByCategory: jest.fn().mockResolvedValue(0),
      findFailedGenerations: jest.fn(),
    };

    const publisherMock = {
      categoryCreated: jest.fn(),
      categoryUpdated: jest.fn(),
      categoryDeleted: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<CategoryPublisher>;

    const auditMock = {
      log: jest.fn().mockResolvedValue(undefined),
      findByEntity: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const storeValidatorMock = {
      assertActive: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<StoreValidator>;

    const loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: CATEGORY_REPOSITORY, useValue: repoMock },
        { provide: PRODUCT_REPOSITORY, useValue: productRepoMock },
        { provide: CategoryPublisher, useValue: publisherMock },
        { provide: AuditService, useValue: auditMock },
        { provide: StoreValidator, useValue: storeValidatorMock },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: loggerMock },
      ],
    }).compile();

    service = module.get(CategoryService);
    repo = repoMock;
    productRepo = productRepoMock;
    publisher = publisherMock;
    auditService = auditMock;
  });

  // ── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns categories from repository', async () => {
      const categories = [makeCategory()];
      repo.findAll.mockResolvedValue(categories);

      const result = await service.findAll(STORE_ID);

      expect(repo.findAll).toHaveBeenCalledWith(STORE_ID);
      expect(result).toBe(categories);
    });
  });

  // ── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns category when found', async () => {
      const category = makeCategory();
      repo.findById.mockResolvedValue(category);

      const result = await service.findById(CAT_ID);

      expect(result).toBe(category);
    });

    it('throws NotFoundException when category does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById(CAT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── findTree ─────────────────────────────────────────────────────────────

  describe('findTree', () => {
    it('returns roots with their children populated', async () => {
      const root = makeCategory({ id: 'root-id', parentId: null });
      const child = makeCategory({ id: 'child-id', parentId: 'root-id' });

      repo.findRootsByStore.mockResolvedValue([root]);
      repo.findChildrenOf.mockResolvedValue([child]);

      const result = await service.findTree(STORE_ID);

      expect(repo.findRootsByStore).toHaveBeenCalledWith(STORE_ID);
      expect(repo.findChildrenOf).toHaveBeenCalledWith('root-id');
      expect(result[0].children).toEqual([child]);
    });

    it('returns empty array when no root categories', async () => {
      repo.findRootsByStore.mockResolvedValue([]);

      const result = await service.findTree(STORE_ID);

      expect(result).toEqual([]);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateCategoryDto = {
      storeId: STORE_ID,
      name: 'Bebidas',
      slug: 'bebidas',
    };

    it('creates category, saves audit log, and publishes event', async () => {
      const created = makeCategory();
      repo.findBySlugAndStore.mockResolvedValue(null);
      repo.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(repo.findBySlugAndStore).toHaveBeenCalledWith('bebidas', STORE_ID);
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityName: 'Category' }),
      );
      expect(publisher.categoryCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: created.id }),
      );
      expect(result).toBe(created);
    });

    it('throws ConflictException when slug already exists in store', async () => {
      repo.findBySlugAndStore.mockResolvedValue(makeCategory({ id: 'other-id' }));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when parentId does not exist', async () => {
      const dtoWithParent = { ...dto, parentId: 'non-existent-parent' };
      repo.findBySlugAndStore.mockResolvedValue(null);
      repo.existsById.mockResolvedValue(false);

      await expect(service.create(dtoWithParent)).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates subcategory when valid parentId provided', async () => {
      const dtoWithParent = { ...dto, parentId: 'parent-id' };
      const created = makeCategory({ parentId: 'parent-id' });
      repo.findBySlugAndStore.mockResolvedValue(null);
      repo.existsById.mockResolvedValue(true);
      repo.create.mockResolvedValue(created);

      const result = await service.create(dtoWithParent);

      expect(repo.existsById).toHaveBeenCalledWith('parent-id');
      expect(result.parentId).toBe('parent-id');
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto: UpdateCategoryDto = { name: 'Bebidas Premium' };

    it('updates category, saves audit log, and publishes event', async () => {
      const existing = makeCategory();
      const updated = makeCategory({ name: 'Bebidas Premium' });
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(updated);

      const result = await service.update(CAT_ID, dto);

      expect(repo.update).toHaveBeenCalledWith(CAT_ID, dto);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', entityName: 'Category' }),
      );
      expect(publisher.categoryUpdated).toHaveBeenCalled();
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when category does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update(CAT_ID, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when new slug already taken in store', async () => {
      const dtoWithSlug: UpdateCategoryDto = { slug: 'bebidas', storeId: STORE_ID };
      repo.findById.mockResolvedValue(makeCategory());
      repo.findBySlugAndStore.mockResolvedValue(makeCategory({ id: 'different-id' }));

      await expect(service.update(CAT_ID, dtoWithSlug)).rejects.toThrow(ConflictException);
    });

    it('allows updating slug when it belongs to the same category', async () => {
      const dtoWithSlug: UpdateCategoryDto = { slug: 'bebidas', storeId: STORE_ID };
      const existing = makeCategory();
      const updated = makeCategory();
      repo.findById.mockResolvedValue(existing);
      repo.findBySlugAndStore.mockResolvedValue(existing); // same id → not a conflict
      repo.update.mockResolvedValue(updated);

      await expect(service.update(CAT_ID, dtoWithSlug)).resolves.toBe(updated);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes category, saves audit log, and publishes event', async () => {
      const category = makeCategory();
      repo.findById.mockResolvedValue(category);
      repo.findChildrenOf.mockResolvedValue([]);
      repo.deleteById.mockResolvedValue(true);

      await service.remove(CAT_ID);

      expect(repo.deleteById).toHaveBeenCalledWith(CAT_ID);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entityName: 'Category' }),
      );
      expect(publisher.categoryDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: CAT_ID }),
      );
    });

    it('throws NotFoundException when category does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.remove(CAT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when category has active children', async () => {
      repo.findById.mockResolvedValue(makeCategory());
      repo.findChildrenOf.mockResolvedValue([makeCategory({ id: 'child-1' })]);

      await expect(service.remove(CAT_ID)).rejects.toThrow(ConflictException);
      expect(repo.deleteById).not.toHaveBeenCalled();
    });

    it('throws ConflictException when category has products (active or not)', async () => {
      repo.findById.mockResolvedValue(makeCategory());
      repo.findChildrenOf.mockResolvedValue([]);
      productRepo.countByCategory.mockResolvedValue(2);

      await expect(service.remove(CAT_ID)).rejects.toThrow(ConflictException);
      expect(repo.deleteById).not.toHaveBeenCalled();
    });
  });
});
