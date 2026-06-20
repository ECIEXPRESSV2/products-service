import { InventoryMovement, MovementType } from '../entities/inventory-movement.entity';
import { LogMovementData } from '../repositories/inventory-movement.repository.interface';

export interface IInventoryService {
  logMovement(data: LogMovementData): Promise<void>;
  findByProduct(productId: string, from?: Date, to?: Date, type?: MovementType): Promise<InventoryMovement[]>;
  findByStore(storeId: string, from?: Date, to?: Date, type?: MovementType): Promise<InventoryMovement[]>;
  find(filters: {
    productId?: string;
    storeId?: string;
    type?: MovementType;
    from?: Date;
    to?: Date;
  }): Promise<InventoryMovement[]>;
  findById(id: string): Promise<InventoryMovement>;
}

export const INVENTORY_SERVICE = Symbol('IInventoryService');
