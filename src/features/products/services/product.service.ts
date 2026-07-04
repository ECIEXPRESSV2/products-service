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
import { SharedEventPublisher } from '../../../messaging/shared-bus/shared-event-publisher.service';
import { PUBLISHED_PRODUCT_EVENTS } from '../../../messaging/shared-bus/contracts';
import type { IPromotionService } from '../../promotions/services/promotion.service.interface';
import { PROMOTION_SERVICE } from '../../promotions/services/promotion.service.interface';
import { ProductWithPricingDto } from '../dto/product-with-pricing.dto';
import { ProductMediaService } from './product-media.service';
import { ProductGenerationStatus } from '../product-generation-status';
import type { ProductImageFiles, ProductImageSet } from '../product-assets.types';

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
    private readonly sharedEventPublisher: SharedEventPublisher,
    @Inject(PROMOTION_SERVICE)
    private readonly promotionService: IPromotionService,
    private readonly productMediaService: ProductMediaService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  findAll(storeId: string, includeInactive = false): Promise<Product[]> {
    this.logger.log(`Listing products for store ${storeId}`, ProductService.name);
    return this.productRepository.findAll(storeId, includeInactive).then((products) => this.makeMediaAccessible(products));
  }

  /**
   * Igual que `findAll`, pero con el precio efectivo (con promoción aplicada) por
   * producto. Es lo que debe consumir cualquier cliente que vaya a usar el precio
   * para cobrar (ej. orders-service al crear un pedido) — `findAll` solo trae el
   * precio base de catálogo.
   */
  async findAllWithPricing(storeId: string, includeInactive = false): Promise<ProductWithPricingDto[]> {
    const products = await this.findAll(storeId, includeInactive);
    return Promise.all(
      products.map(async (product) => {
        const pricing = await this.promotionService.calculateEffectivePrice(
          storeId,
          product.id,
          product.categoryId,
          Number.parseFloat(product.price),
        );
        return Object.assign(new ProductWithPricingDto(), product, {
          effectivePrice: pricing.effectivePrice,
          discountAmount: pricing.discount,
        });
      }),
    );
  }

  findAllPaginated(storeId: string, page: number, limit: number, includeInactive = false): Promise<PaginatedProductResult> {
    this.logger.log(`Listing products paginated store=${storeId} page=${page}`, ProductService.name);
    return this.productRepository.findAllPaginated(storeId, page, limit, includeInactive).then((result) => {
      result.data = this.makeMediaAccessible(result.data);
      return result;
    });
  }

  findByCategory(storeId: string, categoryId: string, includeInactive = false): Promise<Product[]> {
    this.logger.log(`Listing products store=${storeId} category=${categoryId}`, ProductService.name);
    return this.productRepository.findByCategory(storeId, categoryId, includeInactive).then((products) => this.makeMediaAccessible(products));
  }

  findByCategoryPaginated(storeId: string, categoryId: string, page: number, limit: number, includeInactive = false): Promise<PaginatedProductResult> {
    this.logger.log(`Listing products paginated store=${storeId} category=${categoryId} page=${page}`, ProductService.name);
    return this.productRepository.findByCategoryPaginated(storeId, categoryId, page, limit, includeInactive).then((result) => {
      result.data = this.makeMediaAccessible(result.data);
      return result;
    });
  }

  findLowStock(storeId: string): Promise<Product[]> {
    this.logger.log(`Listing low-stock products for store ${storeId}`, ProductService.name);
    return this.productRepository.findLowStock(storeId).then((products) => this.makeMediaAccessible(products));
  }

  search(storeId: string, query: string): Promise<Product[]> {
    this.logger.log(`Searching products query="${query}" store=${storeId}`, ProductService.name);
    return this.productRepository.search(storeId, query).then((products) => this.makeMediaAccessible(products));
  }

  async findById(id: string): Promise<Product> {
    return this.findByIdRaw(id).then((product) => this.makeMediaAccessible(product));
  }

  async create(dto: CreateProductDto, performedBy?: string): Promise<Product> {
    return this.createInternal(dto, performedBy);
  }

  async createWithAssets(dto: CreateProductDto, files: ProductImageFiles, performedBy?: string): Promise<Product> {
    const imageSet = this.productMediaService.validateImages(files);
    return this.createInternal(dto, performedBy, imageSet);
  }

  private async createInternal(
    dto: CreateProductDto,
    performedBy?: string,
    files?: ProductImageSet,
  ): Promise<Product> {
    this.logger.log(
      `Creating product slug="${dto.slug}" store=${dto.storeId}`,
      ProductService.name,
    );

    await this.storeValidator.assertActive(dto.storeId);
    await this.assertCategoryBelongsToStore(dto.categoryId, dto.storeId);
    await this.assertSlugIsUnique(dto.slug, dto.storeId);
    if (dto.sku) await this.assertSkuIsUnique(dto.sku, dto.storeId);

    const product = await this.productRepository.create(dto);
    let savedProduct = product;

    if (files) {
      const processing = await this.productRepository.update(product.id, {
        modelGenerationStatus: ProductGenerationStatus.PROCESSING,
        modelGenerationProgress: 0,
        modelGenerationError: null,
      } as any);
      if (!processing) {
        throw new NotFoundException(`Producto con id "${product.id}" no encontrado`);
      }
      savedProduct = processing;
      void this.processProductAssets(savedProduct.id, files, performedBy).catch((error) => {
        this.logger.error(
          `Error procesando imágenes/modelo 3D del producto ${savedProduct.id}: ${(error as Error).message}`,
          ProductService.name,
        );
      });
    }

    this.logger.log(`Product created id=${savedProduct.id}`, ProductService.name);

    await this.auditService.log({
      entityName: 'Product',
      entityId: savedProduct.id,
      action: AuditAction.CREATE,
      afterData: this.toAuditData(savedProduct),
      performedBy,
    });

    this.publisher.productCreated({
      id: savedProduct.id,
      storeId: savedProduct.storeId,
      categoryId: savedProduct.categoryId,
      name: savedProduct.name,
      slug: savedProduct.slug,
      price: savedProduct.price,
      sku: savedProduct.sku,
      stock: savedProduct.stock,
      imageUrl: savedProduct.imageUrl,
      frontImageUrl: savedProduct.frontImageUrl,
      leftImageUrl: savedProduct.leftImageUrl,
      backImageUrl: savedProduct.backImageUrl,
      model3dUrl: savedProduct.model3dUrl,
      modelGenerationStatus: savedProduct.modelGenerationStatus,
      modelGenerationProgress: savedProduct.modelGenerationProgress,
      modelGenerationError: savedProduct.modelGenerationError,
    });

    return this.makeMediaAccessible(savedProduct);
  }

  private async processProductAssets(productId: string, files: ProductImageSet, performedBy?: string): Promise<void> {
    const before = await this.findByIdRaw(productId);

    try {
      await this.productRepository.update(productId, { modelGenerationProgress: 10 } as any);
      const frontImageUrl = await this.productMediaService.uploadProductImage(productId, 'front', files.front);
      await this.productRepository.update(productId, {
        imageUrl: frontImageUrl,
        frontImageUrl,
        modelGenerationProgress: 35,
      } as any);

      const leftImageUrl = await this.productMediaService.uploadProductImage(productId, 'left', files.left);
      await this.productRepository.update(productId, {
        leftImageUrl,
        modelGenerationProgress: 55,
      } as any);

      const backImageUrl = await this.productMediaService.uploadProductImage(productId, 'back', files.back);
      await this.productRepository.update(productId, {
        backImageUrl,
        modelGenerationProgress: 70,
      } as any);

      const model3dUrl = await this.productMediaService.generateAndUploadModel3d(productId, files);

      const updated = await this.productRepository.update(productId, {
        imageUrl: frontImageUrl,
        frontImageUrl,
        leftImageUrl,
        backImageUrl,
        model3dUrl,
        modelGenerationStatus: ProductGenerationStatus.READY,
        modelGenerationProgress: 100,
        modelGenerationError: null,
      } as any);

      if (!updated) {
        throw new NotFoundException(`Producto con id "${productId}" no encontrado`);
      }

      await this.auditService.log({
        entityName: 'Product',
        entityId: productId,
        action: AuditAction.UPDATE,
        beforeData: this.toAuditData(before),
        afterData: this.toAuditData(updated),
        performedBy,
      });

      this.publisher.productUpdated({
        id: productId,
        storeId: updated.storeId,
        imageUrl: updated.imageUrl,
        frontImageUrl: updated.frontImageUrl,
        leftImageUrl: updated.leftImageUrl,
        backImageUrl: updated.backImageUrl,
        model3dUrl: updated.model3dUrl,
        modelGenerationStatus: updated.modelGenerationStatus,
        modelGenerationProgress: updated.modelGenerationProgress,
        modelGenerationError: updated.modelGenerationError,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      const failed = await this.productRepository.update(productId, {
        modelGenerationStatus: ProductGenerationStatus.FAILED,
        modelGenerationProgress: 100,
        modelGenerationError: message,
      } as any);

      if (failed) {
        this.publisher.productUpdated({
          id: productId,
          storeId: failed.storeId,
          modelGenerationStatus: failed.modelGenerationStatus,
          modelGenerationProgress: failed.modelGenerationProgress,
          modelGenerationError: failed.modelGenerationError,
        });
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto, performedBy?: string): Promise<Product> {
    this.logger.log(`Updating product id=${id}`, ProductService.name);
    const before = await this.findByIdRaw(id);

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
      performedBy,
    });

    this.publisher.productUpdated({ id, storeId: updated.storeId, ...dto });
    return this.makeMediaAccessible(updated);
  }

  async activate(id: string): Promise<Product> {
    this.logger.log(`Activating product id=${id}`, ProductService.name);
    const before = await this.findByIdRaw(id);
    if (before.isActive) return this.makeMediaAccessible(before);

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
    return this.makeMediaAccessible(updated);
  }

  async deactivate(id: string): Promise<Product> {
    this.logger.log(`Deactivating product id=${id}`, ProductService.name);
    const before = await this.findByIdRaw(id);
    if (!before.isActive) return this.makeMediaAccessible(before);

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
    return this.makeMediaAccessible(updated);
  }

  async adjustStock(id: string, dto: AdjustStockDto): Promise<Product> {
    this.logger.log(
      `Adjusting stock id=${id} op=${dto.operation} qty=${dto.quantity}`,
      ProductService.name,
    );
    const product = await this.findByIdRaw(id);

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
    await this.checkAndPublishLowStock(updated);
    return this.makeMediaAccessible(updated);
  }

  async reserveStock(productId: string, quantity: number, orderId: string): Promise<void> {
    this.logger.log(`Reserving ${quantity} units product=${productId} order=${orderId}`, ProductService.name);
    // Reserva ATÓMICA y condicional (no leer-y-luego-escribir): la comprobación de
    // disponibilidad y el incremento van en el mismo UPDATE, garantía ACID contra sobreventa
    // cuando dos pedidos compiten por las últimas unidades.
    const reserved = await this.productRepository.tryReserveStock(productId, quantity);
    if (!reserved) {
      // No se pudo reservar: no había disponible suficiente (o el producto no existe).
      // Reconsultamos solo para construir un mensaje de error claro.
      const current = await this.findByIdRaw(productId).catch(() => null);
      const available = current ? Math.max(0, current.stock - current.reservedStock) : 0;
      throw new ConflictException(
        `Stock disponible insuficiente. Disponible: ${available}, requerido: ${quantity}`,
      );
    }
    await this.inventoryService.logMovement({
      productId,
      storeId: reserved.storeId,
      type: MovementType.RESERVATION,
      quantity,
      stockBefore: reserved.stock,
      stockAfter: reserved.stock,
      // Tomamos los valores del producto ya actualizado para que el log sea exacto aun bajo
      // concurrencia (reserved_stock anterior = actual − lo que acabamos de reservar).
      reservedStockBefore: reserved.reservedStock - quantity,
      reservedStockAfter: reserved.reservedStock,
      referenceId: orderId,
    });
  }

  async releaseStock(productId: string, quantity: number, orderId: string): Promise<void> {
    this.logger.log(`Releasing ${quantity} units product=${productId} order=${orderId}`, ProductService.name);
    // UPDATE atómico (mismo patrón que tryReserveStock/confirmSale): reserved_stock se
    // recalcula en la propia sentencia SQL, no en JS a partir de una lectura previa, así dos
    // liberaciones concurrentes del mismo producto no se pisan entre sí (lost update).
    const updated = await this.productRepository.releaseReservation(productId, quantity);
    if (!updated) {
      throw new NotFoundException(`Producto con id "${productId}" no encontrado`);
    }
    await this.inventoryService.logMovement({
      productId,
      storeId: updated.storeId,
      type: MovementType.RELEASE,
      quantity,
      stockBefore: updated.stock,
      stockAfter: updated.stock,
      reservedStockBefore: updated.reservedStock + quantity,
      reservedStockAfter: updated.reservedStock,
      referenceId: orderId,
    });
  }

  /**
   * Cancelación de una orden que ya había sido CONFIRMED: `confirmReservation`
   * ya descontó `stock` (venta concretada) y dejó `reservedStock` en 0, así que
   * aquí se devuelve la unidad a `stock` — no hay reserva que liberar.
   */
  async restoreStock(productId: string, quantity: number, orderId: string): Promise<void> {
    this.logger.log(`Restoring ${quantity} units product=${productId} order=${orderId}`, ProductService.name);
    // UPDATE atómico: stock = stock + quantity en la propia sentencia SQL, para que dos
    // restituciones concurrentes del mismo producto no se pisen entre sí (lost update).
    const updated = await this.productRepository.incrementStock(productId, quantity);
    if (!updated) {
      throw new NotFoundException(`Producto con id "${productId}" no encontrado`);
    }
    await this.inventoryService.logMovement({
      productId,
      storeId: updated.storeId,
      type: MovementType.RETURN,
      quantity,
      stockBefore: updated.stock - quantity,
      stockAfter: updated.stock,
      reservedStockBefore: updated.reservedStock,
      reservedStockAfter: updated.reservedStock,
      referenceId: orderId,
    });
  }

  async confirmReservation(productId: string, quantity: number, orderId: string): Promise<void> {
    this.logger.log(`Confirming reservation ${quantity} units product=${productId} order=${orderId}`, ProductService.name);
    // UPDATE atómico y condicional (mismo patrón que tryReserveStock): descuenta stock y
    // reserved_stock en UNA sola sentencia SQL, solo si stock >= quantity en ese instante.
    // Reemplaza el antiguo SELECT + resta en JS + UPDATE incondicional, que bajo concurrencia
    // permitía que dos confirmaciones leyeran el mismo stock y ambas escribieran el mismo
    // resultado (lost update) — la causa de la sobreventa cuando dos pedidos confirman a la
    // vez sobre la última unidad. Con el UPDATE condicional, la segunda confirmación
    // re-evalúa el WHERE contra el stock YA descontado por la primera y falla si no alcanza.
    const updated = await this.productRepository.confirmSale(productId, quantity);
    if (!updated) {
      const current = await this.findByIdRaw(productId); // lanza NotFoundException si no existe
      throw new ConflictException(
        `Stock insuficiente para confirmar la venta. Stock: ${current.stock}, cantidad: ${quantity}`,
      );
    }
    await this.inventoryService.logMovement({
      productId,
      storeId: updated.storeId,
      type: MovementType.SALE,
      quantity,
      stockBefore: updated.stock + quantity,
      stockAfter: updated.stock,
      reservedStockBefore: updated.reservedStock + quantity,
      reservedStockAfter: updated.reservedStock,
      referenceId: orderId,
    });
    await this.checkAndPublishLowStock(updated);
  }

  async remove(id: string, performedBy?: string): Promise<void> {
    this.logger.log(`Removing product id=${id}`, ProductService.name);
    const product = await this.findByIdRaw(id);

    await this.productRepository.softDelete(id);

    this.logger.log(`Product soft-deleted id=${id}`, ProductService.name);

    await this.auditService.log({
      entityName: 'Product',
      entityId: id,
      action: AuditAction.DELETE,
      beforeData: this.toAuditData(product),
      performedBy,
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

  /**
   * CU-04: si el stock disponible (stock - reservedStock) cae a `minStock` o
   * por debajo, publica `product.inventory.low_stock` para que los consumidores
   * (e.g. notificaciones a vendedores) puedan alertar reabastecimiento.
   */
  private async checkAndPublishLowStock(product: Product): Promise<void> {
    if (product.minStock <= 0) return;
    const available = product.stock - product.reservedStock;
    if (available > product.minStock) return;

    await this.sharedEventPublisher.publish(PUBLISHED_PRODUCT_EVENTS.LOW_STOCK, {
      productId: product.id,
      storeId: product.storeId,
      name: product.name,
      stock: product.stock,
      reservedStock: product.reservedStock,
      minStock: product.minStock,
    });
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
      imageUrl: product.imageUrl,
      frontImageUrl: product.frontImageUrl,
      leftImageUrl: product.leftImageUrl,
      backImageUrl: product.backImageUrl,
      model3dUrl: product.model3dUrl,
      modelGenerationStatus: product.modelGenerationStatus,
      modelGenerationProgress: product.modelGenerationProgress,
      modelGenerationError: product.modelGenerationError,
      isActive: product.isActive,
      sortOrder: product.sortOrder,
    };
  }

  private async findByIdRaw(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      this.logger.warn(`Product not found: ${id}`, ProductService.name);
      throw new NotFoundException(`Producto con id "${id}" no encontrado`);
    }
    return product;
  }

  private makeMediaAccessible<T extends Product | Product[]>(value: T): T {
    const products = Array.isArray(value) ? value : [value];
    for (const product of products) {
      product.imageUrl = this.productMediaService.toAccessibleUrl(product.imageUrl);
      product.frontImageUrl = this.productMediaService.toAccessibleUrl(product.frontImageUrl);
      product.leftImageUrl = this.productMediaService.toAccessibleUrl(product.leftImageUrl);
      product.backImageUrl = this.productMediaService.toAccessibleUrl(product.backImageUrl);
      product.model3dUrl = this.productMediaService.toAccessibleUrl(product.model3dUrl);
    }
    return value;
  }
}
