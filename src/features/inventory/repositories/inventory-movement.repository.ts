import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InventoryMovement, MovementType } from '../entities/inventory-movement.entity';
import {
  IInventoryMovementRepository,
  LogMovementData,
} from './inventory-movement.repository.interface';

@Injectable()
export class InventoryMovementRepository implements IInventoryMovementRepository {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly orm: Repository<InventoryMovement>,
  ) {}

  async log(data: LogMovementData): Promise<InventoryMovement> {
    const movement = this.orm.create({
      productId: data.productId,
      storeId: data.storeId,
      type: data.type,
      quantity: data.quantity,
      stockBefore: data.stockBefore,
      stockAfter: data.stockAfter,
      reservedStockBefore: data.reservedStockBefore,
      reservedStockAfter: data.reservedStockAfter,
      referenceId: data.referenceId ?? null,
      notes: data.notes ?? null,
    });
    return this.orm.save(movement);
  }

  findByProduct(productId: string, from?: Date, to?: Date, type?: MovementType): Promise<InventoryMovement[]> {
    return this.applyFilters(
      this.orm.createQueryBuilder('m').where('m.productId = :productId', { productId }),
      { from, to, type },
    );
  }

  findByStore(storeId: string, from?: Date, to?: Date, type?: MovementType): Promise<InventoryMovement[]> {
    return this.applyFilters(
      this.orm.createQueryBuilder('m').where('m.storeId = :storeId', { storeId }),
      { from, to, type },
    );
  }

  find(filters: {
    productId?: string;
    storeId?: string;
    type?: MovementType;
    from?: Date;
    to?: Date;
  }): Promise<InventoryMovement[]> {
    const qb = this.orm.createQueryBuilder('m');
    if (filters.productId) qb.andWhere('m.productId = :productId', { productId: filters.productId });
    if (filters.storeId) qb.andWhere('m.storeId = :storeId', { storeId: filters.storeId });
    return this.applyFilters(qb, { from: filters.from, to: filters.to, type: filters.type });
  }

  findById(id: string): Promise<InventoryMovement | null> {
    return this.orm.findOne({ where: { id } });
  }

  private applyFilters(
    qb: SelectQueryBuilder<InventoryMovement>,
    filters: { from?: Date; to?: Date; type?: MovementType },
  ): Promise<InventoryMovement[]> {
    if (filters.type) qb.andWhere('m.type = :type', { type: filters.type });
    if (filters.from) qb.andWhere('m.createdAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('m.createdAt <= :to', { to: filters.to });
    return qb.orderBy('m.createdAt', 'DESC').getMany();
  }
}
