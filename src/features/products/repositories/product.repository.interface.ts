import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PaginatedProductResult } from '../dto/paginated-result.dto';

/**
 * Contrato del repositorio de productos.
 *
 * ISP: expone solo las operaciones que el dominio requiere.
 * DIP: el servicio depende de esta abstracción, no de TypeORM directamente.
 */
export interface IProductRepository {
  findAll(storeId: string, includeInactive?: boolean): Promise<Product[]>;
  findAllPaginated(storeId: string, page: number, limit: number, includeInactive?: boolean): Promise<PaginatedProductResult>;
  findByCategory(storeId: string, categoryId: string, includeInactive?: boolean): Promise<Product[]>;
  findByCategoryPaginated(storeId: string, categoryId: string, page: number, limit: number, includeInactive?: boolean): Promise<PaginatedProductResult>;
  findLowStock(storeId: string): Promise<Product[]>;
  search(storeId: string, query: string): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  findBySlugAndStore(slug: string, storeId: string): Promise<Product | null>;
  findBySkuAndStore(sku: string, storeId: string): Promise<Product | null>;
  create(dto: CreateProductDto): Promise<Product>;
  update(id: string, dto: UpdateProductDto): Promise<Product | null>;
  setStock(id: string, stock: number): Promise<Product | null>;
  adjustReservedStock(id: string, newReservedStock: number): Promise<Product | null>;
  setStockAndReserved(id: string, newStock: number, newReservedStock: number): Promise<Product | null>;
  softDelete(id: string): Promise<boolean>;
  setActive(id: string, isActive: boolean): Promise<Product | null>;
  existsById(id: string): Promise<boolean>;
}

export const PRODUCT_REPOSITORY = Symbol('IProductRepository');
