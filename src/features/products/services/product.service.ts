import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { IProductService } from './product.service.interface';
import type { IProductRepository } from '../repositories/product.repository.interface';
import { PRODUCT_REPOSITORY } from '../repositories/product.repository.interface';
import type { ICategoryRepository } from '../../categories/repositories/category.repository.interface';
import { CATEGORY_REPOSITORY } from '../../categories/repositories/category.repository.interface';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AdjustStockDto, StockOperation } from '../dto/adjust-stock.dto';
import { PaginatedProductResult } from '../dto/paginated-result.dto';
import { Product } from '../entities/product.entity';
import { ProductPublisher } from '../../../messaging/publishers/product.publisher';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import type { IInventoryService } from '../../inventory/services/inventory.service.interface';
import { INVENTORY_SERVICE } from '../../inventory/services/inventory.service.interface';
import { MovementType } from '../../inventory/entities/inventory-movement.entity';
import { StoreValidator } from '../../stores/services/store-validator';

@Injectable()
export class ProductService implements IProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
    private readonly publisher: ProductPublisher,
    private readonly auditService: AuditService,
    private readonly storeValidator: StoreValidator,
    @Inject(INVENTORY_SERVICE)
    private readonly inventoryService: IInventoryService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  findAll(storeId: string, includeInactive = false): Promise<Product[]> {
    this.logger.log(`Listing products for store ${storeId}`, ProductService.name);
    return this.productRepository.findAll(storeId, includeInactive);
  }

  findAllPaginated(storeId: string, page: number, limit: number, includeInactive = false): Promise<PaginatedProductResult> {
    this.logger.log(`Listing products paginated store=${storeId} page=${page}`, ProductService.name);
    return this.productRepository.findAllPaginated(storeId, page, limit, includeInactive);
  }

  findByCategory(storeId: string, categoryId: string, includeInactive = false): Promise<Product[]> {
    this.logger.log(`Listing products store=${storeId} category=${categoryId}`, ProductService.name);
    return this.productRepository.findByCategory(storeId, categoryId, includeInactive);
  }

  findByCategoryPaginated(storeId: string, categoryId: string, page: number, limit: number, includeInactive = false): Promise<PaginatedProductResult> {
    this.logger.log(`Listing products paginated store=${storeId} category=${categoryId} page=${page}`, ProductService.name);
    return this.productRepository.findByCategoryPaginated(storeId, categoryId, page, limit, includeInactive);
  }

  findLowStock(storeId: string): Promise<Product[]> {
    this.logger.log(`Listing low-stock products for store ${storeId}`, ProductService.name);
    return this.productRepository.findLowStock(storeId);
  }

  search(storeId: string, query: string): Promise<Product[]> {
    this.logger.log(`Searching products query="${query}" store=${storeId}`, ProductService.name);
    return this.productRepository.search(storeId, query);
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      this.logger.warn(`Product not found: ${id}`, ProductService.name);
      throw new NotFoundException(`Producto con id "${id}" no encontrado`);
    }
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    this.logger.log(
      `Creating product slug="${dto.slug}" store=${dto.storeId}`,
      ProductService.name,
    );

    await this.storeValidator.assertActive(dto.storeId);
    await this.assertCategoryBelongsToStore(dto.categoryId, dto.storeId);
    await this.assertSlugIsUnique(dto.slug, dto.storeId);
    if (dto.sku) await this.assertSkuIsUnique(dto.sku, dto.storeId);

    const product = await this.productRepository.create(dto);

    this.logger.log(`Product created id=${product.id}`, ProductService.name);

    await this.auditService.log({
      entityName: 'Product',
      entityId: product.id,
      action: AuditAction.CREATE,
      afterData: this.toAuditData(product),
    });

    this.publisher.productCreated({
      id: product.id,
      storeId: product.storeId,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      price: product.price,
      sku: product.sku,
      stock: product.stock,
    });

    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    this.logger.log(`Updating product id=${id}`, ProductService.name);
    const before = await this.findById(id);

    const targetStoreId = dto.storeId ?? before.storeId;

    if (dto.categoryId) {
      await this.assertCategoryBelongsToStore(dto.categoryId, targetStoreId);
    }
    if (dto.slug && dto.slug !== before.slug) {
      await this.assertSlugIsUnique(dto.slug, targetStoreId, id);
    }
    if (dto.sku && dto.sku !== before.sku) {
      await this.assertSkuIsUnique(dto.sku, targetStoreId, id);
    }

    const updated = await this.productRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Producto con id "${id}" no encontrado`);
    }

    this.logger.log(`Product updated id=${id}`, ProductService.name);

    await this.auditService.log({
      entityName: 'Product',
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: this.toAuditData(before),
      afterData: this.toAuditData(updated),
    });

    this.publisher.productUpdated({ id, storeId: updated.storeId, ...dto });
    return updated;
  }

  async activate(id: string): Promise<Product> {
    this.logger.log(`Activating product id=${id}`, ProductService.name);
    const before = await this.findById(id);
    if (before.isActive) return before;

    const updated = await this.productRepository.setActive(id, true);
    if (!updated) throw new NotFoundException(`Producto con id "${id}" no encontrado`);

    await this.auditService.log({
      entityName: 'Product',
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: this.toAuditData(before),
      afterData: this.toAuditData(updated),
    });

    this.publisher.productUpdated({ id, storeId: updated.storeId, isActive: true });
    return updated;
  }

  async deactivate(id: string): Promise<Product> {
    this.logger.log(`Deactivating product id=${id}`, ProductService.name);
    const before = await this.findById(id);
    if (!before.isActive) return before;

    const updated = await this.productRepository.setActive(id, false);
    if (!updated) throw new NotFoundException(`Producto con id "${id}" no encontrado`);

    await this.auditService.log({
      entityName: 'Product',
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: this.toAuditData(before),
      afterData: this.toAuditData(updated),
    });

    this.publisher.productUpdated({ id, storeId: updated.storeId, isActive: false });
    return updated;
  }

  async adjustStock(id: string, dto: AdjustStockDto): Promise<Product> {
    this.logger.log(
      `Adjusting stock id=${id} op=${dto.operation} qty=${dto.quantity}`,
      ProductService.name,
    );
    const product = await this.findById(id);

    let newStock: number;
    let movementType: MovementType;

    if (dto.operation === StockOperation.SET) {
      newStock = dto.quantity;
      movementType = MovementType.ADJUSTMENT;
      if (newStock < product.reservedStock) {
        throw new ConflictException(
          `El stock no puede ser menor al stock reservado (${product.reservedStock} unidades reservadas)`,
        );
      }
    } else if (dto.operation === StockOperation.ADD) {
      newStock = product.stock + dto.quantity;
      movementType = MovementType.PURCHASE;
    } else {
      newStock = product.stock - dto.quantity;
      movementType = MovementType.ADJUSTMENT;
      if (newStock < 0) {
        throw new ConflictException(
          `Stock insuficiente. Stock actual: ${product.stock}, cantidad a restar: ${dto.quantity}`,
        );
      }
      if (newStock < product.reservedStock) {
        throw new ConflictException(
          `El stock resultante (${newStock}) sería menor al stock reservado (${product.reservedStock})`,
        );
      }
    }

    const updated = await this.productRepository.setStock(id, newStock);
    if (!updated) throw new NotFoundException(`Producto con id "${id}" no encontrado`);

    await this.auditService.log({
      entityName: 'Product',
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: { ...this.toAuditData(product), stock: product.stock },
      afterData: { ...this.toAuditData(updated), stock: newStock },
    });

    await this.inventoryService.logMovement({
      productId: id,
      storeId: updated.storeId,
      type: movementType,
      quantity: dto.quantity,
      stockBefore: product.stock,
      stockAfter: newStock,
      reservedStockBefore: product.reservedStock,
      reservedStockAfter: product.reservedStock,
      notes: dto.notes,
    });

    this.publisher.productUpdated({ id, storeId: updated.storeId, stock: newStock });
    return updated;
  }

  async reserveStock(productId: string, quantity: number, orderId: string): Promise<void> {
    this.logger.log(`Reserving ${quantity} units product=${productId} order=${orderId}`, ProductService.name);
    const product = await this.findById(productId);
    const available = product.stock - product.reservedStock;
    if (available < quantity) {
      throw new ConflictException(
        `Stock disponible insuficiente. Disponible: ${available}, requerido: ${quantity}`,
      );
    }
    const newReserved = product.reservedStock + quantity;
    await this.productRepository.adjustReservedStock(productId, newReserved);
    await this.inventoryService.logMovement({
      productId,
      storeId: product.storeId,
      type: MovementType.RESERVATION,
      quantity,
      stockBefore: product.stock,
      stockAfter: product.stock,
      reservedStockBefore: product.reservedStock,
      reservedStockAfter: newReserved,
      referenceId: orderId,
    });
  }

  async releaseStock(productId: string, quantity: number, orderId: string): Promise<void> {
    this.logger.log(`Releasing ${quantity} units product=${productId} order=${orderId}`, ProductService.name);
    const product = await this.findById(productId);
    const newReserved = Math.max(0, product.reservedStock - quantity);
    await this.productRepository.adjustReservedStock(productId, newReserved);
    await this.inventoryService.logMovement({
      productId,
      storeId: product.storeId,
      type: MovementType.RELEASE,
      quantity,
      stockBefore: product.stock,
      stockAfter: product.stock,
      reservedStockBefore: product.reservedStock,
      reservedStockAfter: newReserved,
      referenceId: orderId,
    });
  }

  async confirmReservation(productId: string, quantity: number, orderId: string): Promise<void> {
    this.logger.log(`Confirming reservation ${quantity} units product=${productId} order=${orderId}`, ProductService.name);
    const product = await this.findById(productId);
    const newStock = product.stock - quantity;
    if (newStock < 0) {
      throw new ConflictException(
        `Stock insuficiente para confirmar la venta. Stock: ${product.stock}, cantidad: ${quantity}`,
      );
    }
    const newReserved = Math.max(0, product.reservedStock - quantity);
    await this.productRepository.setStockAndReserved(productId, newStock, newReserved);
    await this.inventoryService.logMovement({
      productId,
      storeId: product.storeId,
      type: MovementType.SALE,
      quantity,
      stockBefore: product.stock,
      stockAfter: newStock,
      reservedStockBefore: product.reservedStock,
      reservedStockAfter: newReserved,
      referenceId: orderId,
    });
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing product id=${id}`, ProductService.name);
    const product = await this.findById(id);

    await this.productRepository.softDelete(id);

    this.logger.log(`Product soft-deleted id=${id}`, ProductService.name);

    await this.auditService.log({
      entityName: 'Product',
      entityId: id,
      action: AuditAction.DELETE,
      beforeData: this.toAuditData(product),
    });

    this.publisher.productDeleted({ id, storeId: product.storeId });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async assertCategoryBelongsToStore(
    categoryId: string,
    storeId: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException(`La categoría con id "${categoryId}" no existe`);
    }
    if (category.storeId !== storeId) {
      throw new ConflictException(
        `La categoría "${categoryId}" no pertenece a la tienda "${storeId}"`,
      );
    }
    if (!category.isActive) {
      throw new ConflictException(`La categoría "${categoryId}" está inactiva`);
    }
  }

  private async assertSlugIsUnique(
    slug: string,
    storeId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.productRepository.findBySlugAndStore(slug, storeId);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Ya existe un producto con el slug "${slug}" en esta tienda`);
    }
  }

  private async assertSkuIsUnique(
    sku: string,
    storeId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.productRepository.findBySkuAndStore(sku, storeId);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Ya existe un producto con el SKU "${sku}" en esta tienda`);
    }
  }

  private toAuditData(product: Product): Record<string, unknown> {
    return {
      id: product.id,
      storeId: product.storeId,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      price: product.price,
      sku: product.sku,
      stock: product.stock,
      isActive: product.isActive,
      sortOrder: product.sortOrder,
    };
  }
}
