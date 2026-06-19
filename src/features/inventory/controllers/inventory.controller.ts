import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { IInventoryService } from '../services/inventory.service.interface';
import { INVENTORY_SERVICE } from '../services/inventory.service.interface';
import { InventoryMovement, MovementType } from '../entities/inventory-movement.entity';
import { QueryMovementsDto } from '../dto/query-movements.dto';

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(INVENTORY_SERVICE)
    private readonly service: IInventoryService,
  ) {}

  @Get('movements')
  @ApiOperation({
    summary: 'Consultar movimientos de inventario con filtros opcionales',
    description:
      'Permite filtrar por tienda, producto, tipo de movimiento y rango de fechas. ' +
      'storeId o productId son obligatorios para evitar consultas sin acotación.',
  })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: MovementType })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601' })
  @ApiOkResponse({ type: [InventoryMovement] })
  find(@Query() query: QueryMovementsDto): Promise<InventoryMovement[]> {
    return this.service.find({
      productId: query.productId,
      storeId: query.storeId,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('movements/product/:productId')
  @ApiOperation({ summary: 'Historial de movimientos de un producto' })
  @ApiQuery({ name: 'type', required: false, enum: MovementType })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ type: [InventoryMovement] })
  findByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('type') type?: MovementType,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<InventoryMovement[]> {
    return this.service.findByProduct(
      productId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      type,
    );
  }

  @Get('movements/store/:storeId')
  @ApiOperation({ summary: 'Historial de movimientos de inventario de una tienda' })
  @ApiQuery({ name: 'type', required: false, enum: MovementType })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ type: [InventoryMovement] })
  findByStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('type') type?: MovementType,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<InventoryMovement[]> {
    return this.service.findByStore(
      storeId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      type,
    );
  }

  @Get('movements/:id')
  @ApiOperation({ summary: 'Obtener un movimiento de inventario por ID' })
  @ApiOkResponse({ type: InventoryMovement })
  @ApiNotFoundResponse()
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<InventoryMovement> {
    return this.service.findById(id);
  }
}
