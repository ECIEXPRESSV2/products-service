import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { IProductRepository } from './product.repository.interface';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PaginatedProductResult } from '../dto/paginated-result.dto';

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

  findAll(storeId: string, includeInactive = false): Promise<Product[]> {
    return this.orm.find({
      where: { storeId, ...(includeInactive ? {} : { isActive: true }) },
      relations: { category: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findAllPaginated(
    storeId: string,
    page: number,
    limit: number,
    includeInactive = false,
  ): Promise<PaginatedProductResult> {
    const [data, total] = await this.orm.findAndCount({
      where: { storeId, ...(includeInactive ? {} : { isActive: true }) },
      relations: { category: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findByCategory(storeId: string, categoryId: string, includeInactive = false): Promise<Product[]> {
    return this.orm.find({
      where: { storeId, categoryId, ...(includeInactive ? {} : { isActive: true }) },
      relations: { category: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findByCategoryPaginated(
    storeId: string,
    categoryId: string,
    page: number,
    limit: number,
    includeInactive = false,
  ): Promise<PaginatedProductResult> {
    const [data, total] = await this.orm.findAndCount({
      where: { storeId, categoryId, ...(includeInactive ? {} : { isActive: true }) },
      relations: { category: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findLowStock(storeId: string): Promise<Product[]> {
    return this.orm
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('product.is_active = true')
      .andWhere('product.min_stock > 0')
      .andWhere('(product.stock - product.reserved_stock) <= product.min_stock')
      .orderBy('(product.stock - product.reserved_stock)', 'ASC')
      .getMany();
  }

  search(storeId: string, query: string): Promise<Product[]> {
    return this.orm
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('product.is_active = true')
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

  async adjustReservedStock(id: string, newReservedStock: number): Promise<Product | null> {
    const result = await this.orm.update(id, { reservedStock: newReservedStock });
    if ((result.affected ?? 0) === 0) return null;
    return this.orm.findOne({ where: { id }, relations: { category: true } });
  }

  async setStockAndReserved(id: string, newStock: number, newReservedStock: number): Promise<Product | null> {
    const result = await this.orm.update(id, { stock: newStock, reservedStock: newReservedStock });
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
}
