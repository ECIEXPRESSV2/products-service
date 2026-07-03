import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { PaginatedProductResult } from '../dto/paginated-result.dto';
import { ProductWithPricingDto } from '../dto/product-with-pricing.dto';
import type { ProductImageFiles } from '../product-assets.types';

/**
 * ISP: contrato mínimo que el controlador necesita; no expone detalles de infraestructura.
 * DIP: el controlador depende de esta interfaz, no de la implementación concreta.
 */
export interface IProductService {
  findAll(storeId: string, includeInactive?: boolean): Promise<Product[]>;
  findAllWithPricing(storeId: string, includeInactive?: boolean): Promise<ProductWithPricingDto[]>;
  findAllPaginated(storeId: string, page: number, limit: number, includeInactive?: boolean): Promise<PaginatedProductResult>;
  findByCategory(storeId: string, categoryId: string, includeInactive?: boolean): Promise<Product[]>;
  findByCategoryPaginated(storeId: string, categoryId: string, page: number, limit: number, includeInactive?: boolean): Promise<PaginatedProductResult>;
  findLowStock(storeId: string): Promise<Product[]>;
  search(storeId: string, query: string): Promise<Product[]>;
  findById(id: string): Promise<Product>;
  create(dto: CreateProductDto, performedBy?: string): Promise<Product>;
  createWithAssets(dto: CreateProductDto, files: ProductImageFiles, performedBy?: string): Promise<Product>;
  update(id: string, dto: UpdateProductDto, performedBy?: string): Promise<Product>;
  activate(id: string): Promise<Product>;
  deactivate(id: string): Promise<Product>;
  adjustStock(id: string, dto: AdjustStockDto): Promise<Product>;
  reserveStock(productId: string, quantity: number, orderId: string): Promise<void>;
  releaseStock(productId: string, quantity: number, orderId: string): Promise<void>;
  restoreStock(productId: string, quantity: number, orderId: string): Promise<void>;
  confirmReservation(productId: string, quantity: number, orderId: string): Promise<void>;
  remove(id: string, performedBy?: string): Promise<void>;
}

export const PRODUCT_SERVICE = Symbol('IProductService');
