import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { ICategoryService } from '../services/category.service.interface';
import { CATEGORY_SERVICE } from '../services/category.service.interface';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category } from '../entities/category.entity';
import { RequireRoles } from '../../../common/decorators/require-roles.decorator';

const STORE_ID_EXAMPLE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

@ApiTags('Categories')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
@ApiForbiddenResponse({ description: 'Rol sin permiso para esta operación' })
@Controller('categories')
export class CategoryController {
  constructor(
    @Inject(CATEGORY_SERVICE)
    private readonly categoryService: ICategoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar categorías activas de una tienda',
    description:
      'Retorna todas las categorías activas (`isActive = true`) de la tienda indicada, ordenadas por `sortOrder` y luego por nombre.',
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    type: String,
    format: 'uuid',
    example: STORE_ID_EXAMPLE,
    description: 'UUID de la tienda cuyas categorías se desean listar',
  })
  @ApiOkResponse({
    description: 'Lista de categorías activas',
    type: [Category],
  })
  @ApiBadRequestResponse({ description: 'storeId no es un UUID válido' })
  findAll(@Query('storeId', ParseUUIDPipe) storeId: string): Promise<Category[]> {
    return this.categoryService.findAll(storeId);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Árbol de categorías raíz con sus hijos directos',
    description:
      'Retorna las categorías raíz (sin `parentId`) de la tienda, cada una con su colección `children` de primer nivel.',
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    type: String,
    format: 'uuid',
    example: STORE_ID_EXAMPLE,
    description: 'UUID de la tienda',
  })
  @ApiOkResponse({
    description: 'Árbol de categorías',
    type: [Category],
  })
  @ApiBadRequestResponse({ description: 'storeId no es un UUID válido' })
  findTree(@Query('storeId', ParseUUIDPipe) storeId: string): Promise<Category[]> {
    return this.categoryService.findTree(storeId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una categoría por ID',
    description: 'Retorna la categoría con sus relaciones `parent` y `children` cargadas.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    description: 'UUID de la categoría',
  })
  @ApiOkResponse({ description: 'Categoría encontrada', type: Category })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada' })
  @ApiBadRequestResponse({ description: 'id no es un UUID válido' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Category> {
    return this.categoryService.findById(id);
  }

  @Post()
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({
    summary: 'Crear una nueva categoría',
    description:
      'Crea una categoría asociada a una tienda. El `slug` debe ser único dentro de la misma tienda. Si se provee `parentId`, la categoría padre debe existir.',
  })
  @ApiCreatedResponse({ description: 'Categoría creada exitosamente', type: Category })
  @ApiConflictResponse({ description: 'El slug ya existe en la tienda' })
  @ApiNotFoundResponse({ description: 'La categoría padre (parentId) no existe' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(dto);
  }

  @Patch(':id')
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({
    summary: 'Actualizar una categoría existente',
    description:
      'Actualización parcial — solo se modifican los campos enviados en el body. Si se actualiza el `slug`, este debe seguir siendo único en la tienda.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    description: 'UUID de la categoría a actualizar',
  })
  @ApiOkResponse({ description: 'Categoría actualizada', type: Category })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada' })
  @ApiConflictResponse({ description: 'El nuevo slug ya existe en la tienda' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @RequireRoles('VENDOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar una categoría (soft delete)',
    description:
      'Marca la categoría como inactiva (`isActive = false`). No se puede eliminar una categoría que tenga subcategorías activas.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    description: 'UUID de la categoría a eliminar',
  })
  @ApiNoContentResponse({ description: 'Categoría eliminada exitosamente' })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada' })
  @ApiConflictResponse({ description: 'La categoría tiene subcategorías activas' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoryService.remove(id);
  }
}
