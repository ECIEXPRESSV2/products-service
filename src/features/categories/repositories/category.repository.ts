import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { ICategoryRepository } from './category.repository.interface';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

/**
 * Implementación concreta del repositorio.
 *
 * Principio SRP: única responsabilidad — acceso a datos de categorías.
 * Principio OCP: si mañana se cambia el ORM, solo se reemplaza esta clase;
 *   el servicio y el controlador no se tocan.
 */
@Injectable()
export class CategoryRepository implements ICategoryRepository {
  constructor(
    @InjectRepository(Category)
    private readonly orm: Repository<Category>,
  ) {}

  findAll(storeId: string): Promise<Category[]> {
    return this.orm.find({
      where: { storeId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  findById(id: string): Promise<Category | null> {
    return this.orm.findOne({
      where: { id },
      relations: { parent: true, children: true },
    });
  }

  findBySlugAndStore(slug: string, storeId: string): Promise<Category | null> {
    return this.orm.findOne({ where: { slug, storeId } });
  }

  findRootsByStore(storeId: string): Promise<Category[]> {
    return this.orm.find({
      where: { storeId, parentId: undefined, isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  findChildrenOf(parentId: string): Promise<Category[]> {
    return this.orm.find({
      where: { parentId, isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const category = this.orm.create({
      storeId: dto.storeId,
      parentId: dto.parentId ?? null,
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.orm.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category | null> {
    const existing = await this.orm.findOne({ where: { id } });
    if (!existing) return null;

    const updated = this.orm.merge(existing, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
    });
    return this.orm.save(updated);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.orm.update(id, { isActive: false });
    return (result.affected ?? 0) > 0;
  }

  existsById(id: string): Promise<boolean> {
    return this.orm.existsBy({ id });
  }
}
