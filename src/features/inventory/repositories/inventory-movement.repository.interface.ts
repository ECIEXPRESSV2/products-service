import { InventoryMovement, MovementType } from '../entities/inventory-movement.entity';

export interface LogMovementData {
  productId: string;
  storeId: string;
  type: MovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reservedStockBefore: number;
  reservedStockAfter: number;
  referenceId?: string;
  notes?: string;
}

export interface IInventoryMovementRepository {
  log(data: LogMovementData): Promise<InventoryMovement>;
  findByProduct(
    productId: string,
    from?: Date,
    to?: Date,
    type?: MovementType,
  ): Promise<InventoryMovement[]>;
  findByStore(
    storeId: string,
    from?: Date,
    to?: Date,
    type?: MovementType,
  ): Promise<InventoryMovement[]>;
  find(filters: {
    productId?: string;
    storeId?: string;
    type?: MovementType;
    from?: Date;
    to?: Date;
  }): Promise<InventoryMovement[]>;
  findById(id: string): Promise<InventoryMovement | null>;
}

export const INVENTORY_MOVEMENT_REPOSITORY = Symbol('IInventoryMovementRepository');
