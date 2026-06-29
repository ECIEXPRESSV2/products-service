import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import databaseConfig from './config/database.config';
import { buildWinstonConfig } from './config/logger.config';
import { CategoriesModule } from './features/categories/categories.module';
import { ProductsModule } from './features/products/products.module';
import { PromotionsModule } from './features/promotions/promotions.module';
import { InventoryModule } from './features/inventory/inventory.module';
import { StoresModule } from './features/stores/stores.module';
import { CartModule } from './features/cart/cart.module';
import { AuthModule } from './common/auth/auth.module';
import { HealthModule } from './features/health/health.module';
import { SharedBusModule } from './messaging/shared-bus/shared-bus.module';
import { MessagingSubscriberModule } from './messaging/shared-bus/messaging-subscriber.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: '.env',
    }),

    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => buildWinstonConfig('ProductsService'),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database') as object,
    }),

    SharedBusModule,
    AuthModule,
    HealthModule,
    StoresModule,
    CategoriesModule,
    ProductsModule,
    PromotionsModule,
    InventoryModule,
    CartModule,
    MessagingSubscriberModule,
  ],
})
export class AppModule {}
