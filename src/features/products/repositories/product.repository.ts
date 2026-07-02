import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { IProductRepository } from './product.repository.interface';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PaginatedProductResult } from '../dto/paginated-result.dto';

/**
 * Nombre de la tabla de la réplica local de Store (`features/stores/entities/store.entity.ts`).
 * Se referencia por nombre de tabla (no se importa la entidad) para evitar un
 * ciclo de módulos entre ProductsModule y StoresModule; el join es puramente SQL.
 */
const STORES_TABLE = 'stores';

/**
 * SRP: única responsabilidad — acceso a datos de productos.
 * OCP: cambiar de ORM solo requiere reemplazar esta clase; servicio y controlador no se tocan.
 */
@Injectable()
export class ProductRepository implements IProductRepository {
  constructor(
    @InjectRepository(Product)
    private readonly orm: Repository<Product>,
  ) {}

  /**
   * Query builder base de lectura: inner join contra la réplica local de
   * Store para excluir productos de tiendas inactivas (CU-03). Equivalente
   * de lectura a `StoreValidator.assertActive` en las rutas de escritura.
   */
  private baseActiveStoreQuery(storeId: string, includeInactive: boolean) {
    const qb = this.orm
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .innerJoin(STORES_TABLE, 'store', 'store.id = product.store_id')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('store.is_active = true');
    if (!includeInactive) {
      qb.andWhere('product.is_active = true');
    }
    return qb;
  }

  findAll(storeId: string, includeInactive = false): Promise<Product[]> {
    return this.baseActiveStoreQuery(storeId, includeInactive)
      .orderBy('product.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .getMany();
  }

  async findAllPaginated(
    storeId: string,
    page: number,
    limit: number,
    includeInactive = false,
  ): Promise<PaginatedProductResult> {
    const [data, total] = await this.baseActiveStoreQuery(storeId, includeInactive)
      .orderBy('product.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findByCategory(storeId: string, categoryId: string, includeInactive = false): Promise<Product[]> {
    return this.baseActiveStoreQuery(storeId, includeInactive)
      .andWhere('product.category_id = :categoryId', { categoryId })
      .orderBy('product.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .getMany();
  }

  async findByCategoryPaginated(
    storeId: string,
    categoryId: string,
    page: number,
    limit: number,
    includeInactive = false,
  ): Promise<PaginatedProductResult> {
    const [data, total] = await this.baseActiveStoreQuery(storeId, includeInactive)
      .andWhere('product.category_id = :categoryId', { categoryId })
      .orderBy('product.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findLowStock(storeId: string): Promise<Product[]> {
    return this.baseActiveStoreQuery(storeId, false)
      .andWhere('product.min_stock > 0')
      .andWhere('(product.stock - product.reserved_stock) <= product.min_stock')
      .orderBy('(product.stock - product.reserved_stock)', 'ASC')
      .getMany();
  }

  search(storeId: string, query: string): Promise<Product[]> {
    return this.baseActiveStoreQuery(storeId, false)
      .andWhere('product.name ILIKE :query', { query: `%${query}%` })
      .orderBy('product.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .getMany();
  }

  findById(id: string): Promise<Product | null> {
    return this.orm.findOne({
      where: { id },
      relations: { category: true },
    });
  }

  findBySlugAndStore(slug: string, storeId: string): Promise<Product | null> {
    return this.orm.findOne({ where: { slug, storeId } });
  }

  findBySkuAndStore(sku: string, storeId: string): Promise<Product | null> {
    return this.orm.findOne({ where: { sku, storeId } });
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.orm.create({
      storeId: dto.storeId,
      categoryId: dto.categoryId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      price: String(dto.price),
      sku: dto.sku ?? null,
      imageUrl: dto.imageUrl ?? null,
      stock: dto.stock ?? 0,
      minStock: dto.minStock ?? 0,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.orm.save(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product | null> {
    const existing = await this.orm.findOne({ where: { id } });
    if (!existing) return null;

    const updated = this.orm.merge(existing, {
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.price !== undefined && { price: String(dto.price) }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      ...(dto.stock !== undefined && { stock: dto.stock }),
      ...(dto.minStock !== undefined && { minStock: dto.minStock }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });
    return this.orm.save(updated);
  }

  async setStock(id: string, stock: number): Promise<Product | null> {
    const result = await this.orm.update(id, { stock });
    if ((result.affected ?? 0) === 0) return null;
    return this.orm.findOne({ where: { id }, relations: { category: true } });
  }

  /**
   * Reserva ACID en un ÚNICO UPDATE condicional: `reserved_stock = reserved_stock + qty`
   * pero solo cuando `stock - reserved_stock >= qty`. La condición y el incremento ocurren
   * en la misma sentencia, así que la base de datos serializa dos reservas concurrentes sobre
   * la misma fila: la primera bloquea la fila y confirma; la segunda re-evalúa el WHERE contra
   * la fila YA actualizada y afecta 0 filas. Resultado: ante la última unidad y dos pedidos
   * simultáneos, solo el más rápido reserva — nunca hay sobreventa.
   */
  async tryReserveStock(id: string, quantity: number): Promise<Product | null> {
    const result = await this.orm
      .createQueryBuilder()
      .update(Product)
      .set({ reservedStock: () => 'reserved_stock + :qtyAdd' })
      .where('id = :id', { id })
      .andWhere('stock - reserved_stock >= :qtyNeed')
      .setParameters({ qtyAdd: quantity, qtyNeed: quantity })
      .execute();
    if ((result.affected ?? 0) === 0) return null;
    return this.orm.findOne({ where: { id }, relations: { category: true } });
  }

  /**
   * Confirmación de venta ACID en un ÚNICO UPDATE condicional: descuenta `stock` y
   * `reserved_stock` en la misma sentencia, pero solo cuando `stock >= quantity`. Reemplaza
   * el patrón leer-y-luego-escribir (SELECT stock, restar en JS, UPDATE incondicional) que,
   * bajo concurrencia, permite que dos confirmaciones lean el mismo `stock` y ambas escriban
   * el mismo resultado (lost update) — la causa de sobreventa cuando dos pedidos confirman a
   * la vez sobre la última unidad. Mismo mecanismo que `tryReserveStock`: la condición y el
   * decremento van en la misma sentencia, así la base de datos serializa las escrituras
   * concurrentes sobre la fila y la segunda confirmación re-evalúa el WHERE contra el stock
   * YA descontado por la primera.
   */
  async confirmSale(id: string, quantity: number): Promise<Product | null> {
    const result = await this.orm
      .createQueryBuilder()
      .update(Product)
      .set({
        stock: () => 'stock - :qtyStock',
        reservedStock: () => 'GREATEST(reserved_stock - :qtyReserved, 0)',
      })
      .where('id = :id', { id })
      .andWhere('stock >= :qtyGuard')
      .setParameters({ qtyStock: quantity, qtyReserved: quantity, qtyGuard: quantity })
      .execute();
    if ((result.affected ?? 0) === 0) return null;
    return this.orm.findOne({ where: { id }, relations: { category: true } });
  }

  /**
   * Libera una reserva no consumida en un ÚNICO UPDATE atómico:
   * `reserved_stock = GREATEST(reserved_stock - quantity, 0)`, sin leer-y-luego-escribir.
   */
  async releaseReservation(id: string, quantity: number): Promise<Product | null> {
    const result = await this.orm
      .createQueryBuilder()
      .update(Product)
      .set({ reservedStock: () => 'GREATEST(reserved_stock - :qty, 0)' })
      .where('id = :id', { id })
      .setParameters({ qty: quantity })
      .execute();
    if ((result.affected ?? 0) === 0) return null;
    return this.orm.findOne({ where: { id }, relations: { category: true } });
  }

  /**
   * Restituye stock físico tras cancelar una venta ya confirmada, en un ÚNICO UPDATE
   * atómico: `stock = stock + quantity`, sin leer-y-luego-escribir.
   */
  async incrementStock(id: string, quantity: number): Promise<Product | null> {
    const result = await this.orm
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => 'stock + :qty' })
      .where('id = :id', { id })
      .setParameters({ qty: quantity })
      .execute();
    if ((result.affected ?? 0) === 0) return null;
    return this.orm.findOne({ where: { id }, relations: { category: true } });
  }

  async setActive(id: string, isActive: boolean): Promise<Product | null> {
    const result = await this.orm.update(id, { isActive });
    if ((result.affected ?? 0) === 0) return null;
    return this.orm.findOne({ where: { id }, relations: { category: true } });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.orm.update(id, { isActive: false });
    return (result.affected ?? 0) > 0;
  }

  existsById(id: string): Promise<boolean> {
    return this.orm.existsBy({ id });
  }

  countActiveByCategory(categoryId: string): Promise<number> {
    return this.orm.count({ where: { categoryId, isActive: true } });
  }
}
