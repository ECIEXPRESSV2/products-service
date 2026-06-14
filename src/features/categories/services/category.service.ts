import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ICategoryService } from './category.service.interface';
import type { ICategoryRepository } from '../repositories/category.repository.interface';
import { CATEGORY_REPOSITORY } from '../repositories/category.repository.interface';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category } from '../entities/category.entity';
import { CategoryPublisher } from '../../../messaging/publishers/category.publisher';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

@Injectable()
export class CategoryService implements ICategoryService {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
    private readonly publisher: CategoryPublisher,
    private readonly auditService: AuditService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  findAll(storeId: string): Promise<Category[]> {
    this.logger.log(`Listing categories for store ${storeId}`, CategoryService.name);
    return this.categoryRepository.findAll(storeId);
  }

  async findById(id: string): Promise<Category> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      this.logger.warn(`Category not found: ${id}`, CategoryService.name);
      throw new NotFoundException(`Categoría con id "${id}" no encontrada`);
    }
    return category;
  }

  async findTree(storeId: string): Promise<Category[]> {
    this.logger.log(`Building category tree for store ${storeId}`, CategoryService.name);
    const roots = await this.categoryRepository.findRootsByStore(storeId);
    return Promise.all(
      roots.map(async (root) => {
        root.children = await this.categoryRepository.findChildrenOf(root.id);
        return root;
      }),
    );
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    this.logger.log(
      `Creating category slug="${dto.slug}" store=${dto.storeId}`,
      CategoryService.name,
    );
    await this.assertSlugIsUnique(dto.slug, dto.storeId);
    await this.assertParentExists(dto.parentId);

    const category = await this.categoryRepository.create(dto);

    this.logger.log(`Category created id=${category.id}`, CategoryService.name);

    await this.auditService.log({
      entityName: 'Category',
      entityId: category.id,
      action: AuditAction.CREATE,
      afterData: this.toAuditData(category),
    });

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
    this.logger.log(`Updating category id=${id}`, CategoryService.name);
    const before = await this.findById(id);

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

    this.logger.log(`Category updated id=${id}`, CategoryService.name);

    await this.auditService.log({
      entityName: 'Category',
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: this.toAuditData(before),
      afterData: this.toAuditData(updated),
    });

    this.publisher.categoryUpdated({ id, storeId: updated.storeId, ...dto });
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing category id=${id}`, CategoryService.name);
    const category = await this.findById(id);

    const children = await this.categoryRepository.findChildrenOf(id);
    if (children.length > 0) {
      throw new ConflictException(
        `La categoría tiene ${children.length} subcategoría(s) activa(s). Elimínalas primero.`,
      );
    }

    await this.categoryRepository.softDelete(id);

    this.logger.log(`Category soft-deleted id=${id}`, CategoryService.name);

    await this.auditService.log({
      entityName: 'Category',
      entityId: id,
      action: AuditAction.DELETE,
      beforeData: this.toAuditData(category),
    });

    this.publisher.categoryDeleted({ id, storeId: category.storeId });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async assertSlugIsUnique(
    slug: string,
    storeId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.categoryRepository.findBySlugAndStore(slug, storeId);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Ya existe una categoría con el slug "${slug}" en esta tienda`);
    }
  }

  private async assertParentExists(parentId?: string): Promise<void> {
    if (!parentId) return;
    const exists = await this.categoryRepository.existsById(parentId);
    if (!exists) {
      throw new NotFoundException(`La categoría padre con id "${parentId}" no existe`);
    }
  }

  private toAuditData(category: Category): Record<string, unknown> {
    return {
      id: category.id,
      storeId: category.storeId,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    };
  }
}
