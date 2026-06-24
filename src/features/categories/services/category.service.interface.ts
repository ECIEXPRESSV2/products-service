import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

/**
 * Contrato del servicio de categorías.
 * El controlador depende de esta interfaz, no de la implementación concreta.
 */
export interface ICategoryService {
  findAll(storeId: string): Promise<Category[]>;
  findById(id: string): Promise<Category>;
  findTree(storeId: string): Promise<Category[]>;
  create(dto: CreateCategoryDto, performedBy?: string): Promise<Category>;
  update(id: string, dto: UpdateCategoryDto, performedBy?: string): Promise<Category>;
  remove(id: string, performedBy?: string): Promise<void>;
}

export const CATEGORY_SERVICE = Symbol('ICategoryService');
