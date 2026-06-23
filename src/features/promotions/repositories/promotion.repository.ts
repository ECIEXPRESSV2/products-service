import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion, PromotionScope } from '../entities/promotion.entity';
import { IPromotionRepository } from './promotion.repository.interface';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';

@Injectable()
export class PromotionRepository implements IPromotionRepository {
  constructor(
    @InjectRepository(Promotion)
    private readonly orm: Repository<Promotion>,
  ) {}

  findAll(storeId: string, includeInactive = false): Promise<Promotion[]> {
    return this.orm.find({
      where: { storeId, ...(includeInactive ? {} : { isActive: true }) },
      order: { createdAt: 'DESC' },
    });
  }

  findActive(storeId: string): Promise<Promotion[]> {
    return this.orm
      .createQueryBuilder('p')
      .where('p.storeId = :storeId', { storeId })
      .andWhere('p.isActive = true')
      .andWhere('p.startsAt <= NOW()')
      .andWhere('(p.endsAt IS NULL OR p.endsAt >= NOW())')
      .orderBy('p.createdAt', 'DESC')
      .getMany();
  }

  findByTarget(
    storeId: string,
    scope: PromotionScope,
    targetId: string,
    onlyActive = true,
  ): Promise<Promotion[]> {
    const qb = this.orm
      .createQueryBuilder('p')
      .where('p.storeId = :storeId', { storeId })
      .andWhere('p.scope = :scope', { scope })
      .andWhere('p.targetId = :targetId', { targetId });

    if (onlyActive) {
      qb.andWhere('p.isActive = true')
        .andWhere('p.startsAt <= NOW()')
        .andWhere('(p.endsAt IS NULL OR p.endsAt >= NOW())');
    }

    return qb.orderBy('p.createdAt', 'DESC').getMany();
  }

  findById(id: string): Promise<Promotion | null> {
    return this.orm.findOne({ where: { id } });
  }

  /**
   * CU-06: promociones activas para el mismo target (producto/categoría) cuyo
   * rango de vigencia se cruza con [startsAt, endsAt]. `endsAt = null` se
   * trata como "sin vencimiento" (rango abierto a futuro).
   */
  findOverlapping(
    storeId: string,
    scope: PromotionScope,
    targetId: string,
    startsAt: Date,
    endsAt: Date | null,
    excludeId?: string,
  ): Promise<Promotion[]> {
    const qb = this.orm
      .createQueryBuilder('p')
      .where('p.storeId = :storeId', { storeId })
      .andWhere('p.scope = :scope', { scope })
      .andWhere('p.targetId = :targetId', { targetId })
      .andWhere('p.isActive = true')
      // p.startsAt <= newEndsAt (o newEndsAt es null => sin límite superior)
      .andWhere('(:endsAt IS NULL OR p.startsAt <= :endsAt)', { endsAt })
      // newStartsAt <= p.endsAt (o p.endsAt es null => sin límite superior)
      .andWhere('(p.endsAt IS NULL OR p.endsAt >= :startsAt)', { startsAt });

    if (excludeId) {
      qb.andWhere('p.id != :excludeId', { excludeId });
    }

    return qb.getMany();
  }

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    const promotion = this.orm.create({
      storeId: dto.storeId,
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      value: String(dto.value),
      scope: dto.scope,
      targetId: dto.targetId,
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      isActive: dto.isActive ?? true,
    });
    return this.orm.save(promotion);
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<Promotion | null> {
    const existing = await this.orm.findOne({ where: { id } });
    if (!existing) return null;

    const updated = this.orm.merge(existing, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.value !== undefined && { value: String(dto.value) }),
      ...(dto.scope !== undefined && { scope: dto.scope }),
      ...(dto.targetId !== undefined && { targetId: dto.targetId }),
      ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
      ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return this.orm.save(updated);
  }

  async setActive(id: string, isActive: boolean): Promise<Promotion | null> {
    const result = await this.orm.update(id, { isActive });
    if ((result.affected ?? 0) === 0) return null;
    return this.orm.findOne({ where: { id } });
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.orm.delete(id);
    return (result.affected ?? 0) > 0;
  }

  existsById(id: string): Promise<boolean> {
    return this.orm.existsBy({ id });
  }
}
