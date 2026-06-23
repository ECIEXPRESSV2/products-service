import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoryRepository } from './repositories/category.repository';
import { CATEGORY_REPOSITORY } from './repositories/category.repository.interface';
import { CategoryService } from './services/category.service';
import { CATEGORY_SERVICE } from './services/category.service.interface';
import { CategoryController } from './controllers/category.controller';
import { RabbitMQModule } from '../../messaging/rabbitmq.module';
import { AuditModule } from '../audit/audit.module';
import { StoresModule } from '../stores/stores.module';
import { Product } from '../products/entities/product.entity';
import { ProductRepository } from '../products/repositories/product.repository';
import { PRODUCT_REPOSITORY } from '../products/repositories/product.repository.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Product]),
    RabbitMQModule,
    AuditModule,
    StoresModule,
  ],
  controllers: [CategoryController],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: CategoryRepository },
    { provide: CATEGORY_SERVICE, useClass: CategoryService },
    // ProductRepository se necesita en CategoryService para impedir borrar
    // categorías con productos activos. Se registra localmente (igual patrón
    // que ProductsModule hace con CATEGORY_REPOSITORY) para evitar el ciclo
    // CategoriesModule <-> ProductsModule.
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepository },
  ],
  exports: [CATEGORY_SERVICE],
})
export class CategoriesModule {}
