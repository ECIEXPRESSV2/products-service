import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, UpdateResult } from 'typeorm';
import { ProductRepository } from './product.repository';
import { Product } from '../entities/product.entity';
import { Category } from '../../categories/entities/category.entity';
import { CreateProductDto } from '../dto/create-product.dto';

const STORE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PRODUCT_ID = 'b2cc188e-9bf9-4888-aa12-ace4e6543111';
const CATEGORY_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_ID,
    storeId: STORE_ID,
    categoryId: CATEGORY_ID,
    category: {} as Category,
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

function makeQueryBuilderMock(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    ...overrides,
  } as unknown as jest.Mocked<SelectQueryBuilder<Product>> & { set: jest.Mock };
  return qb;
}

describe('ProductRepository', () => {
  let repository: ProductRepository;
  let orm: jest.Mocked<Repository<Product>>;

  beforeEach(async () => {
    const ormMock = {
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      update: jest.fn(),
      existsBy: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<Product>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductRepository,
        { provide: getRepositoryToken(Product), useValue: ormMock },
      ],
    }).compile();

    repository = module.get(ProductRepository);
    orm = ormMock;
  });

  // ── findAll ──────────────────────────────────────────────────────────────
  // Nota: estos métodos de lectura ahora usan un query builder con inner join
  // contra la réplica local de `stores` para excluir productos de tiendas
  // inactivas (CU-03), en vez de `orm.find`/`orm.findAndCount`.

  describe('findAll', () => {
    it('finds active products for an active store, ordered by sortOrder and name', async () => {
      const products = [makeProduct()];
      const qb = makeQueryBuilderMock({ getMany: jest.fn().mockResolvedValue(products) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.findAll(STORE_ID);

      expect(orm.createQueryBuilder).toHaveBeenCalledWith('product');
      expect(qb.innerJoin).toHaveBeenCalledWith('stores', 'store', 'store.id = product.store_id');
      expect(qb.where).toHaveBeenCalledWith('product.store_id = :storeId', { storeId: STORE_ID });
      expect(qb.andWhere).toHaveBeenCalledWith('store.is_active = true');
      expect(qb.andWhere).toHaveBeenCalledWith('product.is_active = true');
      expect(qb.orderBy).toHaveBeenCalledWith('product.sort_order', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('product.name', 'ASC');
      expect(result).toBe(products);
    });

    it('does not filter by product.is_active when includeInactive is true', async () => {
      const qb = makeQueryBuilderMock();
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      await repository.findAll(STORE_ID, true);

      expect(qb.andWhere).not.toHaveBeenCalledWith('product.is_active = true');
      // La tienda activa siempre se exige, incluso con includeInactive.
      expect(qb.andWhere).toHaveBeenCalledWith('store.is_active = true');
    });
  });

  // ── findAllPaginated ─────────────────────────────────────────────────────

  describe('findAllPaginated', () => {
    it('returns paginated result with correct metadata', async () => {
      const products = [makeProduct()];
      const qb = makeQueryBuilderMock({ getManyAndCount: jest.fn().mockResolvedValue([products, 1]) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.findAllPaginated(STORE_ID, 1, 20);

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({ data: products, total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('calculates skip correctly for page 2', async () => {
      const qb = makeQueryBuilderMock({ getManyAndCount: jest.fn().mockResolvedValue([[], 50]) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      await repository.findAllPaginated(STORE_ID, 2, 10);

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('calculates totalPages correctly with partial last page', async () => {
      const qb = makeQueryBuilderMock({ getManyAndCount: jest.fn().mockResolvedValue([[], 25]) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.findAllPaginated(STORE_ID, 1, 10);

      expect(result.totalPages).toBe(3);
    });
  });

  // ── findByCategory ────────────────────────────────────────────────────────

  describe('findByCategory', () => {
    it('filters by storeId, categoryId, and active store', async () => {
      const products = [makeProduct()];
      const qb = makeQueryBuilderMock({ getMany: jest.fn().mockResolvedValue(products) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.findByCategory(STORE_ID, CATEGORY_ID);

      expect(qb.where).toHaveBeenCalledWith('product.store_id = :storeId', { storeId: STORE_ID });
      expect(qb.andWhere).toHaveBeenCalledWith('store.is_active = true');
      expect(qb.andWhere).toHaveBeenCalledWith('product.category_id = :categoryId', { categoryId: CATEGORY_ID });
      expect(result).toBe(products);
    });
  });

  // ── findByCategoryPaginated ───────────────────────────────────────────────

  describe('findByCategoryPaginated', () => {
    it('returns paginated result filtered by category', async () => {
      const products = [makeProduct()];
      const qb = makeQueryBuilderMock({ getManyAndCount: jest.fn().mockResolvedValue([products, 1]) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.findByCategoryPaginated(STORE_ID, CATEGORY_ID, 1, 20);

      expect(qb.andWhere).toHaveBeenCalledWith('product.category_id = :categoryId', { categoryId: CATEGORY_ID });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.data).toBe(products);
    });
  });

  // ── findLowStock ─────────────────────────────────────────────────────────

  describe('findLowStock', () => {
    it('queries products where stock <= min_stock ordered by stock ASC, only from active stores', async () => {
      const lowProducts = [makeProduct({ stock: 2 })];
      const qb = makeQueryBuilderMock({ getMany: jest.fn().mockResolvedValue(lowProducts) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.findLowStock(STORE_ID);

      expect(orm.createQueryBuilder).toHaveBeenCalledWith('product');
      expect(qb.where).toHaveBeenCalledWith('product.store_id = :storeId', { storeId: STORE_ID });
      expect(qb.andWhere).toHaveBeenCalledWith('store.is_active = true');
      expect(qb.andWhere).toHaveBeenCalledWith('product.is_active = true');
      expect(qb.andWhere).toHaveBeenCalledWith('product.min_stock > 0');
      expect(qb.andWhere).toHaveBeenCalledWith('(product.stock - product.reserved_stock) <= product.min_stock');
      expect(qb.orderBy).toHaveBeenCalledWith('(product.stock - product.reserved_stock)', 'ASC');
      expect(result).toBe(lowProducts);
    });
  });

  // ── search ───────────────────────────────────────────────────────────────

  describe('search', () => {
    it('searches active products from active stores by name using ILIKE', async () => {
      const products = [makeProduct()];
      const qb = makeQueryBuilderMock({ getMany: jest.fn().mockResolvedValue(products) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.search(STORE_ID, 'café');

      expect(qb.where).toHaveBeenCalledWith('product.store_id = :storeId', { storeId: STORE_ID });
      expect(qb.andWhere).toHaveBeenCalledWith('store.is_active = true');
      expect(qb.andWhere).toHaveBeenCalledWith('product.is_active = true');
      expect(qb.andWhere).toHaveBeenCalledWith('product.name ILIKE :query', { query: '%café%' });
      expect(result).toBe(products);
    });
  });

  // ── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('finds product with category relation', async () => {
      const product = makeProduct();
      orm.findOne.mockResolvedValue(product);

      const result = await repository.findById(PRODUCT_ID);

      expect(orm.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        relations: { category: true },
      });
      expect(result).toBe(product);
    });

    it('returns null when product not found', async () => {
      orm.findOne.mockResolvedValue(null);

      expect(await repository.findById('non-existent')).toBeNull();
    });
  });

  // ── findBySlugAndStore / findBySkuAndStore ────────────────────────────────

  describe('findBySlugAndStore', () => {
    it('finds product by slug and storeId', async () => {
      const product = makeProduct();
      orm.findOne.mockResolvedValue(product);

      const result = await repository.findBySlugAndStore('cafe-americano', STORE_ID);

      expect(orm.findOne).toHaveBeenCalledWith({ where: { slug: 'cafe-americano', storeId: STORE_ID } });
      expect(result).toBe(product);
    });

    it('returns null when no match', async () => {
      orm.findOne.mockResolvedValue(null);
      expect(await repository.findBySlugAndStore('no-existe', STORE_ID)).toBeNull();
    });
  });

  describe('findBySkuAndStore', () => {
    it('finds product by sku and storeId', async () => {
      const product = makeProduct({ sku: 'CAF-001' });
      orm.findOne.mockResolvedValue(product);

      const result = await repository.findBySkuAndStore('CAF-001', STORE_ID);

      expect(orm.findOne).toHaveBeenCalledWith({ where: { sku: 'CAF-001', storeId: STORE_ID } });
      expect(result).toBe(product);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and saves a product from DTO', async () => {
      const dto: CreateProductDto = {
        storeId: STORE_ID,
        categoryId: CATEGORY_ID,
        name: 'Café Americano',
        slug: 'cafe-americano',
        price: 3500,
        sku: 'CAF-001',
        stock: 10,
        minStock: 2,
      };
      const product = makeProduct();
      orm.create.mockReturnValue(product);
      orm.save.mockResolvedValue(product);

      const result = await repository.create(dto);

      expect(orm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: STORE_ID,
          categoryId: CATEGORY_ID,
          slug: 'cafe-americano',
          price: '3500',
          sku: 'CAF-001',
          stock: 10,
          minStock: 2,
        }),
      );
      expect(orm.save).toHaveBeenCalledWith(product);
      expect(result).toBe(product);
    });

    it('sets optional fields to null / defaults when not provided', async () => {
      const dto: CreateProductDto = {
        storeId: STORE_ID,
        categoryId: CATEGORY_ID,
        name: 'Producto',
        slug: 'producto',
        price: 1000,
      };
      const product = makeProduct({ sku: null, description: null, imageUrl: null, stock: 0, minStock: 0 });
      orm.create.mockReturnValue(product);
      orm.save.mockResolvedValue(product);

      await repository.create(dto);

      expect(orm.create).toHaveBeenCalledWith(
        expect.objectContaining({ sku: null, description: null, imageUrl: null, stock: 0, minStock: 0 }),
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('merges and saves changes when product exists', async () => {
      const existing = makeProduct();
      const updated = makeProduct({ name: 'Café Premium' });
      orm.findOne.mockResolvedValue(existing);
      orm.merge.mockReturnValue(updated);
      orm.save.mockResolvedValue(updated);

      const result = await repository.update(PRODUCT_ID, { name: 'Café Premium' });

      expect(orm.findOne).toHaveBeenCalledWith({ where: { id: PRODUCT_ID } });
      expect(orm.merge).toHaveBeenCalled();
      expect(orm.save).toHaveBeenCalledWith(updated);
      expect(result).toBe(updated);
    });

    it('returns null when product does not exist', async () => {
      orm.findOne.mockResolvedValue(null);

      const result = await repository.update('non-existent', { name: 'X' });

      expect(result).toBeNull();
      expect(orm.save).not.toHaveBeenCalled();
    });

    it('converts price to string when provided', async () => {
      const existing = makeProduct();
      orm.findOne.mockResolvedValue(existing);
      orm.merge.mockReturnValue(existing);
      orm.save.mockResolvedValue(existing);

      await repository.update(PRODUCT_ID, { price: 5000 });

      expect(orm.merge).toHaveBeenCalledWith(
        existing,
        expect.objectContaining({ price: '5000' }),
      );
    });
  });

  // ── setStock ─────────────────────────────────────────────────────────────

  describe('setStock', () => {
    it('updates stock and returns the refreshed product', async () => {
      const product = makeProduct({ stock: 30 });
      orm.update.mockResolvedValue({ affected: 1 } as UpdateResult);
      orm.findOne.mockResolvedValue(product);

      const result = await repository.setStock(PRODUCT_ID, 30);

      expect(orm.update).toHaveBeenCalledWith(PRODUCT_ID, { stock: 30 });
      expect(result).toBe(product);
    });

    it('returns null when no row was affected', async () => {
      orm.update.mockResolvedValue({ affected: 0 } as UpdateResult);

      const result = await repository.setStock('non-existent', 10);

      expect(result).toBeNull();
      expect(orm.findOne).not.toHaveBeenCalled();
    });
  });

  // ── confirmSale ──────────────────────────────────────────────────────────
  // Confirmación de venta ACID: descuenta stock y reserved_stock en un ÚNICO UPDATE
  // condicional (WHERE stock >= qty), nunca lee-y-luego-escribe.

  describe('confirmSale', () => {
    it('issues a single conditional UPDATE guarded by stock >= quantity', async () => {
      const qb = makeQueryBuilderMock({ execute: jest.fn().mockResolvedValue({ affected: 1 }) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);
      const product = makeProduct({ stock: 17, reservedStock: 2 });
      orm.findOne.mockResolvedValue(product);

      const result = await repository.confirmSale(PRODUCT_ID, 3);

      expect(qb.update).toHaveBeenCalledWith(Product);
      expect(qb.set).toHaveBeenCalledWith({
        stock: expect.any(Function),
        reservedStock: expect.any(Function),
      });
      expect(qb.where).toHaveBeenCalledWith('id = :id', { id: PRODUCT_ID });
      expect(qb.andWhere).toHaveBeenCalledWith('stock >= :qtyGuard');
      expect(qb.setParameters).toHaveBeenCalledWith({ qtyStock: 3, qtyReserved: 3, qtyGuard: 3 });
      expect(result).toBe(product);
    });

    it('returns null (no overselling) when the conditional UPDATE affects 0 rows', async () => {
      const qb = makeQueryBuilderMock({ execute: jest.fn().mockResolvedValue({ affected: 0 }) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.confirmSale(PRODUCT_ID, 5);

      expect(result).toBeNull();
      expect(orm.findOne).not.toHaveBeenCalled();
    });
  });

  // ── releaseReservation ───────────────────────────────────────────────────

  describe('releaseReservation', () => {
    it('issues a single UPDATE that clamps reserved_stock at 0', async () => {
      const qb = makeQueryBuilderMock({ execute: jest.fn().mockResolvedValue({ affected: 1 }) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);
      const product = makeProduct({ reservedStock: 0 });
      orm.findOne.mockResolvedValue(product);

      const result = await repository.releaseReservation(PRODUCT_ID, 10);

      expect(qb.set).toHaveBeenCalledWith({ reservedStock: expect.any(Function) });
      expect(qb.where).toHaveBeenCalledWith('id = :id', { id: PRODUCT_ID });
      expect(qb.setParameters).toHaveBeenCalledWith({ qty: 10 });
      expect(result).toBe(product);
    });

    it('returns null when the product does not exist', async () => {
      const qb = makeQueryBuilderMock({ execute: jest.fn().mockResolvedValue({ affected: 0 }) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.releaseReservation('non-existent', 1);

      expect(result).toBeNull();
    });
  });

  // ── incrementStock ───────────────────────────────────────────────────────

  describe('incrementStock', () => {
    it('issues a single UPDATE that adds to stock', async () => {
      const qb = makeQueryBuilderMock({ execute: jest.fn().mockResolvedValue({ affected: 1 }) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);
      const product = makeProduct({ stock: 23 });
      orm.findOne.mockResolvedValue(product);

      const result = await repository.incrementStock(PRODUCT_ID, 3);

      expect(qb.set).toHaveBeenCalledWith({ stock: expect.any(Function) });
      expect(qb.where).toHaveBeenCalledWith('id = :id', { id: PRODUCT_ID });
      expect(qb.setParameters).toHaveBeenCalledWith({ qty: 3 });
      expect(result).toBe(product);
    });

    it('returns null when the product does not exist', async () => {
      const qb = makeQueryBuilderMock({ execute: jest.fn().mockResolvedValue({ affected: 0 }) });
      orm.createQueryBuilder.mockReturnValue(qb as unknown as SelectQueryBuilder<Product>);

      const result = await repository.incrementStock('non-existent', 1);

      expect(result).toBeNull();
    });
  });

  // ── setActive ─────────────────────────────────────────────────────────────

  describe('setActive', () => {
    it('updates isActive and returns the refreshed product', async () => {
      const product = makeProduct({ isActive: false });
      orm.update.mockResolvedValue({ affected: 1 } as UpdateResult);
      orm.findOne.mockResolvedValue(product);

      const result = await repository.setActive(PRODUCT_ID, false);

      expect(orm.update).toHaveBeenCalledWith(PRODUCT_ID, { isActive: false });
      expect(result).toBe(product);
    });

    it('returns null when no row was affected', async () => {
      orm.update.mockResolvedValue({ affected: 0 } as UpdateResult);

      expect(await repository.setActive('non-existent', true)).toBeNull();
    });
  });

  // ── softDelete ───────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('sets isActive to false and returns true when affected', async () => {
      orm.update.mockResolvedValue({ affected: 1 } as UpdateResult);

      expect(await repository.softDelete(PRODUCT_ID)).toBe(true);
      expect(orm.update).toHaveBeenCalledWith(PRODUCT_ID, { isActive: false });
    });

    it('returns false when no row was affected', async () => {
      orm.update.mockResolvedValue({ affected: 0 } as UpdateResult);

      expect(await repository.softDelete('non-existent')).toBe(false);
    });
  });

  // ── existsById ───────────────────────────────────────────────────────────

  describe('existsById', () => {
    it('returns true when product exists', async () => {
      orm.existsBy.mockResolvedValue(true);

      expect(await repository.existsById(PRODUCT_ID)).toBe(true);
      expect(orm.existsBy).toHaveBeenCalledWith({ id: PRODUCT_ID });
    });

    it('returns false when product does not exist', async () => {
      orm.existsBy.mockResolvedValue(false);

      expect(await repository.existsById('non-existent')).toBe(false);
    });
  });

  // ── countActiveByCategory ────────────────────────────────────────────────

  describe('countActiveByCategory', () => {
    it('counts active products in a category', async () => {
      orm.count.mockResolvedValue(3);

      const result = await repository.countActiveByCategory(CATEGORY_ID);

      expect(orm.count).toHaveBeenCalledWith({ where: { categoryId: CATEGORY_ID, isActive: true } });
      expect(result).toBe(3);
    });
  });
});
