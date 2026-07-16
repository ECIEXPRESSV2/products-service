import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

/**
 * Contrato del repositorio de categorías.
 *
 * Principio ISP (Interface Segregation): expone solo las operaciones
 * que el dominio necesita, sin acoplar al servicio a TypeORM directamente.
 * Principio DIP (Dependency Inversion): el servicio depende de esta
 * abstracción, no de la implementación concreta.
 */
export interface ICategoryRepository {
  findAll(storeId: string): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findBySlugAndStore(slug: string, storeId: string): Promise<Category | null>;
  findRootsByStore(storeId: string): Promise<Category[]>;
  findChildrenOf(parentId: string): Promise<Category[]>;
  create(dto: CreateCategoryDto): Promise<Category>;
  update(id: string, dto: UpdateCategoryDto): Promise<Category | null>;
  /** Borrado físico de la fila (libera el slug para recrear la categoría). */
  deleteById(id: string): Promise<boolean>;
  existsById(id: string): Promise<boolean>;
}

export const CATEGORY_REPOSITORY = Symbol('ICategoryRepository');
