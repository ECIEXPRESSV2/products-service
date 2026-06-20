import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseFloatPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { IPromotionService } from '../services/promotion.service.interface';
import { PROMOTION_SERVICE } from '../services/promotion.service.interface';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';
import { Promotion, PromotionScope } from '../entities/promotion.entity';
import { RequireRoles } from '../../../common/decorators/require-roles.decorator';

@ApiTags('Promotions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
@ApiForbiddenResponse({ description: 'Rol sin permiso para esta operación' })
@Controller('promotions')
export class PromotionController {
  constructor(
    @Inject(PROMOTION_SERVICE)
    private readonly service: IPromotionService,
  ) {}

  // ── Queries ─────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar promociones de una tienda' })
  @ApiQuery({ name: 'storeId', required: true, description: 'UUID de la tienda' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiOkResponse({ type: [Promotion] })
  findAll(
    @Query('storeId', ParseUUIDPipe) storeId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<Promotion[]> {
    return this.service.findAll(storeId, includeInactive === 'true');
  }

  @Get('active')
  @ApiOperation({ summary: 'Listar promociones activas y vigentes de una tienda' })
  @ApiQuery({ name: 'storeId', required: true })
  @ApiOkResponse({ type: [Promotion] })
  findActive(@Query('storeId', ParseUUIDPipe) storeId: string): Promise<Promotion[]> {
    return this.service.findActive(storeId);
  }

  @Get('by-target')
  @ApiOperation({ summary: 'Listar promociones activas para un producto o categoría específico' })
  @ApiQuery({ name: 'storeId', required: true })
  @ApiQuery({ name: 'scope', enum: PromotionScope })
  @ApiQuery({ name: 'targetId', required: true, description: 'UUID del producto o categoría' })
  @ApiOkResponse({ type: [Promotion] })
  findByTarget(
    @Query('storeId', ParseUUIDPipe) storeId: string,
    @Query('scope') scope: PromotionScope,
    @Query('targetId', ParseUUIDPipe) targetId: string,
  ): Promise<Promotion[]> {
    return this.service.findByTarget(storeId, scope, targetId);
  }

  @Get('effective-price')
  @ApiOperation({
    summary: 'Calcular precio efectivo de un producto aplicando la mejor promoción vigente',
  })
  @ApiQuery({ name: 'storeId', required: true })
  @ApiQuery({ name: 'productId', required: true })
  @ApiQuery({ name: 'categoryId', required: true })
  @ApiQuery({ name: 'basePrice', required: true, type: Number })
  calculateEffectivePrice(
    @Query('storeId', ParseUUIDPipe) storeId: string,
    @Query('productId', ParseUUIDPipe) productId: string,
    @Query('categoryId', ParseUUIDPipe) categoryId: string,
    @Query('basePrice', ParseFloatPipe) basePrice: number,
  ) {
    return this.service.calculateEffectivePrice(storeId, productId, categoryId, basePrice);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una promoción por ID' })
  @ApiOkResponse({ type: Promotion })
  @ApiNotFoundResponse({ description: 'Promoción no encontrada' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Promotion> {
    return this.service.findById(id);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  @Post()
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({ summary: 'Crear una nueva promoción' })
  @ApiOkResponse({ type: Promotion })
  create(@Body() dto: CreatePromotionDto): Promise<Promotion> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({ summary: 'Actualizar una promoción' })
  @ApiOkResponse({ type: Promotion })
  @ApiNotFoundResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<Promotion> {
    return this.service.update(id, dto);
  }

  @Patch(':id/activate')
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({ summary: 'Activar una promoción' })
  @ApiOkResponse({ type: Promotion })
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<Promotion> {
    return this.service.activate(id);
  }

  @Patch(':id/deactivate')
  @RequireRoles('VENDOR', 'ADMIN')
  @ApiOperation({ summary: 'Desactivar una promoción' })
  @ApiOkResponse({ type: Promotion })
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<Promotion> {
    return this.service.deactivate(id);
  }

  @Delete(':id')
  @RequireRoles('VENDOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una promoción' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
