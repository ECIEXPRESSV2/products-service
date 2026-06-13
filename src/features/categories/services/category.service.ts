import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ICategoryService } from './category.service.interface';
import type {
  ICategoryRepository,
} from '../repositories/category.repository.interface';
import { CATEGORY_REPOSITORY } from '../repositories/category.repository.interface';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category } from '../entities/category.entity';
import { CategoryPublisher } from '../../../messaging/publishers/category.publisher';

/**
 * Principio SRP: orquesta la lógica de negocio de categorías.
 * Principio DIP: recibe el repositorio por inyección de dependencias
 *   usando el token simbólico, sin acoplarse a TypeORM.
 */
@Injectable()
export class CategoryService implements ICategoryService {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
    private readonly publisher: CategoryPublisher,
  ) {}

  findAll(storeId: string): Promise<Category[]> {
    return this.categoryRepository.findAll(storeId);
  }

  async findById(id: string): Promise<Category> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Categoría con id "${id}" no encontrada`);
    }
    return category;
  }

  /**
   * Retorna el árbol de categorías raíz con sus hijos directos para una tienda.
   */
  async findTree(storeId: string): Promise<Category[]> {
    const roots = await this.categoryRepository.findRootsByStore(storeId);
    const withChildren = await Promise.all(
      roots.map(async (root) => {
        root.children = await this.categoryRepository.findChildrenOf(root.id);
        return root;
      }),
    );
    return withChildren;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.assertSlugIsUnique(dto.slug, dto.storeId);
    await this.assertParentExists(dto.parentId);
    const category = await this.categoryRepository.create(dto);
    this.publisher.categoryCreated({
      id: category.id,
      storeId: category.storeId,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
    });
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findById(id); // lanza NotFoundException si no existe

    if (dto.slug && dto.storeId) {
      await this.assertSlugIsUnique(dto.slug, dto.storeId, id);
    }
    if (dto.parentId) {
      await this.assertParentExists(dto.parentId);
    }

    const updated = await this.categoryRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Categoría con id "${id}" no encontrada`);
    }
    this.publisher.categoryUpdated({ id, storeId: updated.storeId, ...dto });
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id); // lanza NotFoundException si no existe
    const children = await this.categoryRepository.findChildrenOf(id);
    if (children.length > 0) {
      throw new ConflictException(
        `La categoría tiene ${children.length} subcategoría(s) activa(s). Elimínalas primero.`,
      );
    }
    const category = await this.categoryRepository.findById(id) as Category;
    await this.categoryRepository.softDelete(id);
    this.publisher.categoryDeleted({ id, storeId: category.storeId });
  }

  // ── Métodos privados de validación ──────────────────────────────────────

  private async assertSlugIsUnique(
    slug: string,
    storeId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.categoryRepository.findBySlugAndStore(
      slug,
      storeId,
    );
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Ya existe una categoría con el slug "${slug}" en esta tienda`,
      );
    }
  }

  private async assertParentExists(parentId?: string): Promise<void> {
    if (!parentId) return;
    const exists = await this.categoryRepository.existsById(parentId);
    if (!exists) {
      throw new NotFoundException(
        `La categoría padre con id "${parentId}" no existe`,
      );
    }
  }
}
