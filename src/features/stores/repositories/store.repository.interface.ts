import { Store } from '../entities/store.entity';

export const STORE_REPOSITORY = Symbol('STORE_REPOSITORY');

export interface StoreSnapshot {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  status: string;
  isActive: boolean;
  location: string | null;
}

export interface IStoreRepository {
  findById(id: string): Promise<Store | null>;
  existsActive(id: string): Promise<boolean>;
  /** Inserta o reemplaza la réplica local con el snapshot autoritativo de Identity. */
  upsert(snapshot: StoreSnapshot): Promise<Store>;
  deleteById(id: string): Promise<void>;
}
