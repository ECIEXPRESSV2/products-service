import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { PaginatedProductResult } from '../dto/paginated-result.dto';

/**
 * ISP: contrato mínimo que el controlador necesita; no expone detalles de infraestructura.
 * DIP: el controlador depende de esta interfaz, no de la implementación concreta.
 */
export interface IProductService {
  findAll(storeId: string, includeInactive?: boolean): Promise<Product[]>;
  findAllPaginated(storeId: string, page: number, limit: number, includeInactive?: boolean): Promise<PaginatedProductResult>;
  findByCategory(storeId: string, categoryId: string, includeInactive?: boolean): Promise<Product[]>;
  findByCategoryPaginated(storeId: string, categoryId: string, page: number, limit: number, includeInactive?: boolean): Promise<PaginatedProductResult>;
  findLowStock(storeId: string): Promise<Product[]>;
  search(storeId: string, query: string): Promise<Product[]>;
  findById(id: string): Promise<Product>;
  create(dto: CreateProductDto): Promise<Product>;
  update(id: string, dto: UpdateProductDto): Promise<Product>;
  activate(id: string): Promise<Product>;
  deactivate(id: string): Promise<Product>;
  adjustStock(id: string, dto: AdjustStockDto): Promise<Product>;
  reserveStock(productId: string, quantity: number, orderId: string): Promise<void>;
  releaseStock(productId: string, quantity: number, orderId: string): Promise<void>;
  confirmReservation(productId: string, quantity: number, orderId: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export const PRODUCT_SERVICE = Symbol('IProductService');
