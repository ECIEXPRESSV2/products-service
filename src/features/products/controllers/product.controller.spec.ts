import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { PRODUCT_SERVICE } from '../services/product.service.interface';
import { IProductService } from '../services/product.service.interface';
import { Product } from '../entities/product.entity';
import { Category } from '../../categories/entities/category.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { StockOperation } from '../dto/adjust-stock.dto';
import { PaginatedProductResult } from '../dto/paginated-result.dto';

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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    minStock: 5,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePaginated(products: Product[]): PaginatedProductResult {
  return { data: products, total: products.length, page: 1, limit: 20, totalPages: 1 };
}

describe('ProductController', () => {
  let controller: ProductController;
  let service: jest.Mocked<IProductService>;

  beforeEach(async () => {
    const serviceMock: jest.Mocked<IProductService> = {
      findAll: jest.fn(),
      findAllPaginated: jest.fn(),
      findByCategory: jest.fn(),
      findByCategoryPaginated: jest.fn(),
      findLowStock: jest.fn(),
      search: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      adjustStock: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: PRODUCT_SERVICE, useValue: serviceMock }],
    }).compile();

    controller = module.get(ProductController);
    service = serviceMock;
  });

  describe('findAll — GET /products', () => {
    it('delegates to service.search when search param provided', async () => {
      const products = [makeProduct()];
      service.search.mockResolvedValue(products);

      const result = await controller.findAll(STORE_ID, undefined, 'café');

      expect(service.search).toHaveBeenCalledWith(STORE_ID, 'café');
      expect(result).toBe(products);
    });

    it('delegates to service.findByCategory when categoryId provided', async () => {
      const products = [makeProduct()];
      service.findByCategory.mockResolvedValue(products);

      const result = await controller.findAll(STORE_ID, CATEGORY_ID);

      expect(service.findByCategory).toHaveBeenCalledWith(STORE_ID, CATEGORY_ID, undefined);
      expect(result).toBe(products);
    });

    it('delegates to service.findAll by default', async () => {
      const products = [makeProduct()];
      service.findAll.mockResolvedValue(products);

      const result = await controller.findAll(STORE_ID);

      expect(service.findAll).toHaveBeenCalledWith(STORE_ID, undefined);
      expect(result).toBe(products);
    });
  });

  describe('findByStore — GET /products/store/:storeId', () => {
    it('delegates to service.findAllPaginated with defaults', async () => {
      const paginated = makePaginated([makeProduct()]);
      service.findAllPaginated.mockResolvedValue(paginated);

      const result = await controller.findByStore(STORE_ID, {});

      expect(service.findAllPaginated).toHaveBeenCalledWith(STORE_ID, 1, 20, undefined);
      expect(result).toBe(paginated);
    });

    it('passes custom page and limit to service', async () => {
      const paginated = makePaginated([]);
      service.findAllPaginated.mockResolvedValue(paginated);

      await controller.findByStore(STORE_ID, { page: 3, limit: 10 });

      expect(service.findAllPaginated).toHaveBeenCalledWith(STORE_ID, 3, 10, undefined);
    });
  });

  describe('findLowStock — GET /products/store/:storeId/low-stock', () => {
    it('delegates to service.findLowStock', async () => {
      const products = [makeProduct({ stock: 2 })];
      service.findLowStock.mockResolvedValue(products);

      const result = await controller.findLowStock(STORE_ID);

      expect(service.findLowStock).toHaveBeenCalledWith(STORE_ID);
      expect(result).toBe(products);
    });
  });

  describe('findByCategory — GET /products/store/:storeId/category/:categoryId', () => {
    it('delegates to service.findByCategoryPaginated with defaults', async () => {
      const paginated = makePaginated([makeProduct()]);
      service.findByCategoryPaginated.mockResolvedValue(paginated);

      await controller.findByCategory(STORE_ID, CATEGORY_ID, {});

      expect(service.findByCategoryPaginated).toHaveBeenCalledWith(
        STORE_ID,
        CATEGORY_ID,
        1,
        20,
        undefined,
      );
    });
  });

  describe('findOne — GET /products/:id', () => {
    it('delegates to service.findById', async () => {
      const product = makeProduct();
      service.findById.mockResolvedValue(product);

      const result = await controller.findOne(PRODUCT_ID);

      expect(service.findById).toHaveBeenCalledWith(PRODUCT_ID);
      expect(result).toBe(product);
    });
  });

  describe('create — POST /products', () => {
    it('delegates to service.create and returns created product', async () => {
      const dto: CreateProductDto = {
        storeId: STORE_ID,
        categoryId: CATEGORY_ID,
        name: 'Café Americano',
        slug: 'cafe-americano',
        price: 3500,
      };
      const created = makeProduct();
      service.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });
  });

  describe('activate — PATCH /products/:id/activate', () => {
    it('delegates to service.activate', async () => {
      const product = makeProduct({ isActive: true });
      service.activate.mockResolvedValue(product);

      const result = await controller.activate(PRODUCT_ID);

      expect(service.activate).toHaveBeenCalledWith(PRODUCT_ID);
      expect(result).toBe(product);
    });
  });

  describe('deactivate — PATCH /products/:id/deactivate', () => {
    it('delegates to service.deactivate', async () => {
      const product = makeProduct({ isActive: false });
      service.deactivate.mockResolvedValue(product);

      const result = await controller.deactivate(PRODUCT_ID);

      expect(service.deactivate).toHaveBeenCalledWith(PRODUCT_ID);
      expect(result).toBe(product);
    });
  });

  describe('adjustStock — PATCH /products/:id/stock', () => {
    it('delegates to service.adjustStock', async () => {
      const dto = { operation: StockOperation.ADD, quantity: 10 };
      const updated = makeProduct({ stock: 30 });
      service.adjustStock.mockResolvedValue(updated);

      const result = await controller.adjustStock(PRODUCT_ID, dto);

      expect(service.adjustStock).toHaveBeenCalledWith(PRODUCT_ID, dto);
      expect(result).toBe(updated);
    });
  });

  describe('remove — DELETE /products/:id', () => {
    it('delegates to service.remove', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(PRODUCT_ID);

      expect(service.remove).toHaveBeenCalledWith(PRODUCT_ID);
    });
  });
});
