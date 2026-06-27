import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Repository, UpdateResult } from 'typeorm';
import { CategoryRepository } from './category.repository';
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

describe('CategoryRepository', () => {
  let categoryRepository: CategoryRepository;
  let orm: jest.Mocked<Repository<Category>>;

  beforeEach(async () => {
    const ormMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      update: jest.fn(),
      existsBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<Category>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoryRepository, { provide: getRepositoryToken(Category), useValue: ormMock }],
    }).compile();

    categoryRepository = module.get(CategoryRepository);
    orm = ormMock;
  });

  describe('findAll', () => {
    it('finds active categories for store ordered by sortOrder and name', async () => {
      const categories = [makeCategory()];
      orm.find.mockResolvedValue(categories);

      const result = await categoryRepository.findAll(STORE_ID);

      expect(orm.find).toHaveBeenCalledWith({
        where: { storeId: STORE_ID, isActive: true },
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
      expect(result).toBe(categories);
    });
  });

  describe('findById', () => {
    it('finds category by id with parent and children relations', async () => {
      const category = makeCategory();
      orm.findOne.mockResolvedValue(category);

      const result = await categoryRepository.findById(CAT_ID);

      expect(orm.findOne).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        relations: { parent: true, children: true },
      });
      expect(result).toBe(category);
    });

    it('returns null when category not found', async () => {
      orm.findOne.mockResolvedValue(null);

      const result = await categoryRepository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findBySlugAndStore', () => {
    it('finds category by slug and storeId', async () => {
      const category = makeCategory();
      orm.findOne.mockResolvedValue(category);

      const result = await categoryRepository.findBySlugAndStore('bebidas', STORE_ID);

      expect(orm.findOne).toHaveBeenCalledWith({ where: { slug: 'bebidas', storeId: STORE_ID } });
      expect(result).toBe(category);
    });

    it('returns null when no match', async () => {
      orm.findOne.mockResolvedValue(null);

      const result = await categoryRepository.findBySlugAndStore('no-existe', STORE_ID);

      expect(result).toBeNull();
    });
  });

  describe('findRootsByStore', () => {
    it('finds root categories (parentId IS NULL) ordered by sortOrder', async () => {
      const roots = [makeCategory()];
      orm.find.mockResolvedValue(roots);

      const result = await categoryRepository.findRootsByStore(STORE_ID);

      expect(orm.find).toHaveBeenCalledWith({
        where: { storeId: STORE_ID, parentId: IsNull(), isActive: true },
        order: { sortOrder: 'ASC' },
      });
      expect(result).toBe(roots);
    });
  });

  describe('findChildrenOf', () => {
    it('finds active children of a parent', async () => {
      const children = [makeCategory({ id: 'child-id', parentId: CAT_ID })];
      orm.find.mockResolvedValue(children);

      const result = await categoryRepository.findChildrenOf(CAT_ID);

      expect(orm.find).toHaveBeenCalledWith({
        where: { parentId: CAT_ID, isActive: true },
        order: { sortOrder: 'ASC' },
      });
      expect(result).toBe(children);
    });
  });

  describe('create', () => {
    it('creates and persists a category from DTO', async () => {
      const dto: CreateCategoryDto = {
        storeId: STORE_ID,
        name: 'Bebidas',
        slug: 'bebidas',
        description: 'Refrescos y jugos',
        sortOrder: 1,
        isActive: true,
      };
      const category = makeCategory(dto);
      orm.create.mockReturnValue(category);
      orm.save.mockResolvedValue(category);

      const result = await categoryRepository.create(dto);

      expect(orm.create).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE_ID, slug: 'bebidas' }),
      );
      expect(orm.save).toHaveBeenCalledWith(category);
      expect(result).toBe(category);
    });

    it('sets parentId to null when dto.parentId is undefined', async () => {
      const dto: CreateCategoryDto = { storeId: STORE_ID, name: 'Root', slug: 'root' };
      const category = makeCategory({ parentId: null });
      orm.create.mockReturnValue(category);
      orm.save.mockResolvedValue(category);

      await categoryRepository.create(dto);

      expect(orm.create).toHaveBeenCalledWith(expect.objectContaining({ parentId: null }));
    });
  });

  describe('update', () => {
    it('merges and saves changes when category exists', async () => {
      const dto: UpdateCategoryDto = { name: 'Bebidas Premium' };
      const existing = makeCategory();
      const updated = makeCategory({ name: 'Bebidas Premium' });
      orm.findOne.mockResolvedValue(existing);
      orm.merge.mockReturnValue(updated);
      orm.save.mockResolvedValue(updated);

      const result = await categoryRepository.update(CAT_ID, dto);

      expect(orm.findOne).toHaveBeenCalledWith({ where: { id: CAT_ID } });
      expect(orm.merge).toHaveBeenCalled();
      expect(orm.save).toHaveBeenCalledWith(updated);
      expect(result).toBe(updated);
    });

    it('returns null when category does not exist', async () => {
      orm.findOne.mockResolvedValue(null);

      const result = await categoryRepository.update('non-existent', { name: 'X' });

      expect(result).toBeNull();
      expect(orm.save).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('sets isActive to false and returns true when affected', async () => {
      orm.update.mockResolvedValue({ affected: 1 } as UpdateResult);

      const result = await categoryRepository.softDelete(CAT_ID);

      expect(orm.update).toHaveBeenCalledWith(CAT_ID, { isActive: false });
      expect(result).toBe(true);
    });

    it('returns false when no row was affected', async () => {
      orm.update.mockResolvedValue({ affected: 0 } as UpdateResult);

      const result = await categoryRepository.softDelete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('existsById', () => {
    it('returns true when category exists', async () => {
      orm.existsBy.mockResolvedValue(true);

      const result = await categoryRepository.existsById(CAT_ID);

      expect(orm.existsBy).toHaveBeenCalledWith({ id: CAT_ID });
      expect(result).toBe(true);
    });

    it('returns false when category does not exist', async () => {
      orm.existsBy.mockResolvedValue(false);

      const result = await categoryRepository.existsById('non-existent');

      expect(result).toBe(false);
    });
  });
});
