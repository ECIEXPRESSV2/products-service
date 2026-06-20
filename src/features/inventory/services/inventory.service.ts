import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { IInventoryService } from './inventory.service.interface';
import type { IInventoryMovementRepository } from '../repositories/inventory-movement.repository.interface';
import { INVENTORY_MOVEMENT_REPOSITORY } from '../repositories/inventory-movement.repository.interface';
import type { LogMovementData } from '../repositories/inventory-movement.repository.interface';
import { InventoryMovement, MovementType } from '../entities/inventory-movement.entity';

@Injectable()
export class InventoryService implements IInventoryService {
  constructor(
    @Inject(INVENTORY_MOVEMENT_REPOSITORY)
    private readonly repo: IInventoryMovementRepository,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async logMovement(data: LogMovementData): Promise<void> {
    try {
      await this.repo.log(data);
    } catch (error) {
      this.logger.error(
        `Failed to log inventory movement product=${data.productId} type=${data.type}`,
        error,
        InventoryService.name,
      );
    }
  }

  findByProduct(productId: string, from?: Date, to?: Date, type?: MovementType): Promise<InventoryMovement[]> {
    this.logger.log(`Querying movements product=${productId}`, InventoryService.name);
    return this.repo.findByProduct(productId, from, to, type);
  }

  findByStore(storeId: string, from?: Date, to?: Date, type?: MovementType): Promise<InventoryMovement[]> {
    this.logger.log(`Querying movements store=${storeId}`, InventoryService.name);
    return this.repo.findByStore(storeId, from, to, type);
  }

  find(filters: {
    productId?: string;
    storeId?: string;
    type?: MovementType;
    from?: Date;
    to?: Date;
  }): Promise<InventoryMovement[]> {
    return this.repo.find(filters);
  }

  async findById(id: string): Promise<InventoryMovement> {
    const movement = await this.repo.findById(id);
    if (!movement) {
      throw new NotFoundException(`Movimiento de inventario con id "${id}" no encontrado`);
    }
    return movement;
  }
}
