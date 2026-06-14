import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import databaseConfig from './config/database.config';
import { buildWinstonConfig } from './config/logger.config';
import { CategoriesModule } from './features/categories/categories.module';

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

    CategoriesModule,
  ],
})
export class AppModule {}
