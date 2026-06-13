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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ICategoryService } from '../services/category.service.interface';
import { CATEGORY_SERVICE } from '../services/category.service.interface';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category } from '../entities/category.entity';

/**
 * Principio SRP: única responsabilidad — exponer los endpoints HTTP de categorías.
 * Principio DIP: depende de ICategoryService, no de la implementación concreta.
 */
@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(
    @Inject(CATEGORY_SERVICE)
    private readonly categoryService: ICategoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las categorías activas de una tienda' })
  @ApiQuery({ name: 'storeId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Lista de categorías', type: [Category] })
  findAll(@Query('storeId', ParseUUIDPipe) storeId: string): Promise<Category[]> {
    return this.categoryService.findAll(storeId);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Árbol de categorías raíz con sus hijos directos' })
  @ApiQuery({ name: 'storeId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Árbol de categorías', type: [Category] })
  findTree(@Query('storeId', ParseUUIDPipe) storeId: string): Promise<Category[]> {
    return this.categoryService.findTree(storeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: Category })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Category> {
    return this.categoryService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva categoría' })
  @ApiResponse({ status: 201, type: Category })
  @ApiResponse({ status: 409, description: 'Slug duplicado en la tienda' })
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una categoría existente' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: Category })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar (soft delete) una categoría' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Categoría eliminada' })
  @ApiResponse({ status: 409, description: 'La categoría tiene subcategorías activas' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoryService.remove(id);
  }
}
