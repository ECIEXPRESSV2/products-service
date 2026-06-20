import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/**
 * Todos los campos de CreateCategoryDto son opcionales en la actualización.
 * PartialType de Swagger preserva los decoradores de validación y documentación.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
