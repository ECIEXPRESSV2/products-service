import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store, StoreStatus, StoreType } from '../entities/store.entity';
import { IStoreRepository, StoreSnapshot } from './store.repository.interface';

@Injectable()
export class StoreRepository implements IStoreRepository {
  constructor(
    @InjectRepository(Store)
    private readonly repository: Repository<Store>,
  ) {}

  findById(id: string): Promise<Store | null> {
    return this.repository.findOne({ where: { id } });
  }

  async existsActive(id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { id, isActive: true },
    });
    return count > 0;
  }

  async upsert(snapshot: StoreSnapshot): Promise<Store> {
    await this.repository.upsert(
      {
        id: snapshot.id,
        ownerId: snapshot.ownerId,
        name: snapshot.name,
        type: snapshot.type as StoreType,
        status: snapshot.status as StoreStatus,
        isActive: snapshot.isActive,
        location: snapshot.location,
        syncedAt: new Date(),
      },
      ['id'],
    );
    return (await this.findById(snapshot.id)) as Store;
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
