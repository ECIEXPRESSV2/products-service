import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseBoolPipe,
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
import type { IProductService } from '../services/product.service.interface';
import { PRODUCT_SERVICE } from '../services/product.service.interface';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedProductResult } from '../dto/paginated-result.dto';
import { Product } from '../entities/product.entity';
import { RequireRoles } from '../../../common/decorators/require-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/guards/gateway-auth.guard';

const STORE_ID_EXAMPLE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PRODUCT_ID_EXAMPLE = 'b2cc188e-9bf9-4888-aa12-ace4e6543111';

@ApiTags('Products')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
@ApiForbiddenResponse({ description: 'Rol sin permiso para esta operación' })
@Controller('products')
export class ProductController {
  constructor(
    @Inject(PRODUCT_SERVICE)
    private readonly productService: IProductService,
  ) {}

  // ── Consultas ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Listar productos de una tienda',
    description:
      'Retorna productos de la tienda. Por defecto solo los activos. ' +
      'Filtra por categoría con `categoryId`. ' +
      'Busca por nombre con `search`. ' +
      'Incluye inactivos con `includeInactive=true` (vista admin).',
  })
  @ApiQuery({ name: 'storeId', required: true, type: String, format: 'uuid', example: STORE_ID_EXAMPLE })
  @ApiQuery({ name: 'categoryId', required: false, type: String, format: 'uuid', description: 'Filtrar por categoría' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'café', description: 'Búsqueda parcial por nombre (case-insensitive)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, example: false, description: 'Incluir productos inactivos' })
  @ApiOkResponse({ description: 'Lista de productos', type: [Product] })
  @ApiBadRequestResponse({ description: 'Parámetros inválidos' })
  findAll(
    @Query('storeId', ParseUUIDPipe) storeId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
  ): Promise<Product[]> {
    if (search) {
      return this.productService.search(storeId, search);
    }
    if (categoryId) {
      return this.productService.findByCategory(storeId, categoryId, includeInactive);
    }
    return this.productService.findAll(storeId, includeInactive);
  }

  @Get('store/:storeId')
  @ApiOperation({
    summary: 'Listar productos de una tienda (paginado)',
    description:
      'Retorna los productos de la tienda con paginación. ' +
      'Incluye inactivos con `includeInactive=true`.',
  })
  @ApiParam({ name: 'storeId', type: String, format: 'uuid', example: STORE_ID_EXAMPLE, description: 'UUID de la tienda' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, example: false, description: 'Incluir productos inactivos' })
  @ApiOkResponse({ description: 'Página de productos de la tienda', type: PaginatedProductResult })
  @ApiBadRequestResponse({ description: 'storeId no es un UUID válido' })
  findByStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() pagination: PaginationDto,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
  ): Promise<PaginatedProductResult> {
    return this.productService.findAllPaginated(
      storeId,
      pagination.page ?? 1,
      pagination.limit ?? 20,
      includeInactive,
    );
  }

  @Get('store/:storeId/low-stock')
  @RequireRoles('VENDOR', 'ADMIN', 'ANALYST')
  @ApiOperation({
    summary: 'Productos con inventario bajo en una tienda',
    description: 'Retorna los productos activos cuyo `stock <= minStock`. Útil para alertas de reabastecimiento.',
  })
  @ApiParam({ name: 'storeId', type: String, format: 'uuid', example: STORE_ID_EXAMPLE, description: 'UUID de la tienda' })
  @ApiOkResponse({ description: 'Productos con inventario bajo', type: [Product] })
  @ApiBadRequestResponse({ description: 'storeId no es un UUID válido' })
  findLowStock(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<Product[]> {
    return this.productService.findLowStock(storeId);
  }

  @Get('store/:storeId/category/:categoryId')
  @ApiOperation({
    summary: 'Listar productos de una categoría en una tienda (paginado)',
    description:
      'Retorna los productos de la categoría indicada con paginación. ' +
      'Incluye inactivos con `includeInactive=true`.',
  })
  @ApiParam({ name: 'storeId', type: String, format: 'uuid', example: STORE_ID_EXAMPLE, description: 'UUID de la tienda' })
  @ApiParam({ name: 'categoryId', type: String, format: 'uuid', example: 'a3bb189e-8bf9-3888-9912-ace4e6543002', description: 'UUID de la categoría' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, example: false, description: 'Incluir productos inactivos' })
  @ApiOkResponse({ description: 'Página de productos de la categoría', type: PaginatedProductResult })
  @ApiBadRequestResponse({ description: 'storeId o categoryId no son UUIDs válidos' })
  findByCategory(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() pagination: PaginationDto,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
  ): Promise<PaginatedProductResult> {
    return this.productService.findByCategoryPaginated(
      storeId,
      categoryId,
      pagination.page ?? 1,
      pagination.limit ?? 20,
      includeInactive,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un producto por ID', description: 'Retorna el producto con su categoría cargada.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', example: PRODUCT_ID_EXAMPLE })
  @ApiOkResponse({ description: 'Producto encontrado', type: Product })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  @ApiBadRequestResponse({ description: 'id no es un UUID válido' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productService.findById(id);
  }

  // ── Mutaciones ───────────────────────────────────────────────────────────

  @Post()
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({
    summary: 'Crear un nuevo producto',
    description:
      'Crea un producto en la categoría indicada. La categoría debe pertenecer a la misma tienda. ' +
      '`slug` y `sku` deben ser únicos por tienda.',
  })
  @ApiCreatedResponse({ description: 'Producto creado exitosamente', type: Product })
  @ApiConflictResponse({ description: 'Slug o SKU duplicado, o categoría de otra tienda' })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<Product> {
    return this.productService.create(dto, user?.userId);
  }

  @Patch(':id')
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({
    summary: 'Actualizar campos de un producto',
    description: 'Actualización parcial. Solo se modifican los campos enviados en el body.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', example: PRODUCT_ID_EXAMPLE })
  @ApiOkResponse({ description: 'Producto actualizado', type: Product })
  @ApiNotFoundResponse({ description: 'Producto o categoría no encontrados' })
  @ApiConflictResponse({ description: 'Slug o SKU duplicado en la tienda' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<Product> {
    return this.productService.update(id, dto, user?.userId);
  }

  // ── Gestión de disponibilidad (RF-04 / RF-05) ────────────────────────────

  @Patch(':id/activate')
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({
    summary: 'Activar un producto',
    description: 'Marca el producto como activo (`isActive = true`) y lo hace visible en el catálogo. Idempotente: si ya está activo, no produce cambios.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', example: PRODUCT_ID_EXAMPLE })
  @ApiOkResponse({ description: 'Producto activado', type: Product })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productService.activate(id);
  }

  @Patch(':id/deactivate')
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({
    summary: 'Desactivar un producto',
    description: 'Marca el producto como inactivo (`isActive = false`) y lo oculta del catálogo sin eliminarlo. Idempotente: si ya está inactivo, no produce cambios.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', example: PRODUCT_ID_EXAMPLE })
  @ApiOkResponse({ description: 'Producto desactivado', type: Product })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productService.deactivate(id);
  }

  // ── Gestión de inventario (RF-05) ────────────────────────────────────────

  @Patch(':id/stock')
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({
    summary: 'Ajustar el stock de un producto',
    description:
      '`set` reemplaza el stock con el valor exacto. ' +
      '`add` suma unidades al stock actual. ' +
      '`subtract` resta unidades; falla con 409 si el resultado sería negativo.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', example: PRODUCT_ID_EXAMPLE })
  @ApiOkResponse({ description: 'Stock actualizado', type: Product })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  @ApiConflictResponse({ description: 'Stock insuficiente para la operación subtract' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
  ): Promise<Product> {
    return this.productService.adjustStock(id, dto);
  }

  // ── Eliminación (soft delete) ────────────────────────────────────────────

  @Delete(':id')
  @RequireRoles('VENDOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar un producto (soft delete)',
    description: 'Marca el producto como inactivo. Para eliminación lógica permanente; usa `deactivate` para ocultarlo temporalmente.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', example: PRODUCT_ID_EXAMPLE })
  @ApiNoContentResponse({ description: 'Producto eliminado' })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<void> {
    return this.productService.remove(id, user?.userId);
  }
}
