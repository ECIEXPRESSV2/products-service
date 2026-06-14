import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CATEGORY_SERVICE } from '../services/category.service.interface';
import { ICategoryService } from '../services/category.service.interface';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

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

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: jest.Mocked<ICategoryService>;

  beforeEach(async () => {
    const serviceMock: jest.Mocked<ICategoryService> = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findTree: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CATEGORY_SERVICE, useValue: serviceMock }],
    }).compile();

    controller = module.get(CategoryController);
    service = serviceMock;
  });

  describe('findAll', () => {
    it('delegates to service.findAll with storeId', async () => {
      const categories = [makeCategory()];
      service.findAll.mockResolvedValue(categories);

      const result = await controller.findAll(STORE_ID);

      expect(service.findAll).toHaveBeenCalledWith(STORE_ID);
      expect(result).toBe(categories);
    });
  });

  describe('findTree', () => {
    it('delegates to service.findTree with storeId', async () => {
      const tree = [makeCategory({ children: [makeCategory({ id: 'child-id' })] })];
      service.findTree.mockResolvedValue(tree);

      const result = await controller.findTree(STORE_ID);

      expect(service.findTree).toHaveBeenCalledWith(STORE_ID);
      expect(result).toBe(tree);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findById', async () => {
      const category = makeCategory();
      service.findById.mockResolvedValue(category);

      const result = await controller.findOne(CAT_ID);

      expect(service.findById).toHaveBeenCalledWith(CAT_ID);
      expect(result).toBe(category);
    });
  });

  describe('create', () => {
    it('delegates to service.create and returns created category', async () => {
      const dto: CreateCategoryDto = { storeId: STORE_ID, name: 'Bebidas', slug: 'bebidas' };
      const created = makeCategory();
      service.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('delegates to service.update with id and dto', async () => {
      const dto: UpdateCategoryDto = { name: 'Bebidas Premium' };
      const updated = makeCategory({ name: 'Bebidas Premium' });
      service.update.mockResolvedValue(updated);

      const result = await controller.update(CAT_ID, dto);

      expect(service.update).toHaveBeenCalledWith(CAT_ID, dto);
      expect(result).toBe(updated);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove and returns void', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(CAT_ID);

      expect(service.remove).toHaveBeenCalledWith(CAT_ID);
    });
  });
});
