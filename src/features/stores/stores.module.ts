import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Store } from './entities/store.entity';
import { StoreRepository } from './repositories/store.repository';
import { STORE_REPOSITORY } from './repositories/store.repository.interface';
import { StoreSyncService } from './services/store-sync.service';
import { STORE_SYNC_SERVICE } from './services/store-sync.service.interface';
import { IdentityApiClient } from './clients/identity-api.client';
import { IDENTITY_API_CLIENT } from './clients/identity-api.client';
import { IdentityEventsConsumer } from './messaging/identity-events.consumer';
import { StoreController } from './controllers/store.controller';
import { StoreValidator } from './services/store-validator';

@Module({
  imports: [TypeOrmModule.forFeature([Store]), HttpModule],
  controllers: [StoreController],
  providers: [
    { provide: STORE_REPOSITORY, useClass: StoreRepository },
    { provide: IDENTITY_API_CLIENT, useClass: IdentityApiClient },
    { provide: STORE_SYNC_SERVICE, useClass: StoreSyncService },
    IdentityEventsConsumer,
    StoreValidator,
  ],
  exports: [STORE_REPOSITORY, STORE_SYNC_SERVICE, StoreValidator],
})
export class StoresModule {}
