import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { IStoreSyncService } from './store-sync.service.interface';
import type { IStoreRepository } from '../repositories/store.repository.interface';
import { STORE_REPOSITORY } from '../repositories/store.repository.interface';
import type { IIdentityApiClient } from '../clients/identity-api.client';
import { IDENTITY_API_CLIENT } from '../clients/identity-api.client';

@Injectable()
export class StoreSyncService implements IStoreSyncService {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly storeRepository: IStoreRepository,
    @Inject(IDENTITY_API_CLIENT)
    private readonly identityApiClient: IIdentityApiClient,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async reconcile(storeId: string): Promise<void> {
    this.logger.log(`Reconciling store=${storeId} with identity-service`, StoreSyncService.name);

    const snapshot = await this.identityApiClient.fetchStore(storeId);

    if (!snapshot) {
      // La tienda no existe (o fue eliminada) en Identity: no debe quedar réplica local.
      await this.storeRepository.deleteById(storeId);
      this.logger.warn(`Store=${storeId} not found in identity-service, local replica removed`, StoreSyncService.name);
      return;
    }

    await this.storeRepository.upsert(snapshot);
    this.logger.log(`Store=${storeId} replica synced (status=${snapshot.status})`, StoreSyncService.name);
  }
}
