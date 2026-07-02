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
  /**
   * Reserva atómica: incrementa `reserved_stock` en `quantity` SOLO si hay disponible
   * suficiente. Devuelve el producto actualizado si la reserva se aplicó, o `null` si no
   * había stock disponible (o el producto no existe). Garantía ACID a nivel de fila.
   */
  tryReserveStock(id: string, quantity: number): Promise<Product | null>;
  /**
   * Confirmación de venta atómica: descuenta `stock` y `reserved_stock` en la misma
   * sentencia SQL, SOLO si `stock >= quantity`. Devuelve `null` si no hay stock físico
   * suficiente (o el producto no existe). Mismo patrón condicional que `tryReserveStock`.
   */
  confirmSale(id: string, quantity: number): Promise<Product | null>;
  /**
   * Libera una reserva no consumida (cancelación antes de confirmar): decrementa
   * `reserved_stock` atómicamente, sin bajar de 0. Devuelve `null` si el producto no existe.
   */
  releaseReservation(id: string, quantity: number): Promise<Product | null>;
  /**
   * Restituye stock físico tras cancelar una venta ya confirmada: incrementa `stock`
   * atómicamente. Devuelve `null` si el producto no existe.
   */
  incrementStock(id: string, quantity: number): Promise<Product | null>;
  softDelete(id: string): Promise<boolean>;
  setActive(id: string, isActive: boolean): Promise<Product | null>;
  existsById(id: string): Promise<boolean>;
  countActiveByCategory(categoryId: string): Promise<number>;
}

export const PRODUCT_REPOSITORY = Symbol('IProductRepository');
